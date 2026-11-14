package documents

import (
	"bytes"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"reflect"
	"slices"
	"strings"
	"testing"
	"time"

	"wails-desktop-template/backend"
	"wails-desktop-template/backend/fsutil"
)

// newLibrary returns a library in a fresh temporary folder, with its data folder
// beside it, so no test ever touches the user's real config directory.
func newLibrary(t *testing.T) *Library {
	t.Helper()

	data := t.TempDir()
	library := New(backend.Shell{DataFolder: func() (string, error) { return data, nil }, Emit: func(string, ...any) {}})
	library.root = t.TempDir()

	return library
}

// libraryEntries lists the names in dir, sorted, so a test can say exactly what
// the folder holds — including that nothing else is left behind.
func libraryEntries(t *testing.T, dir string) []string {
	t.Helper()

	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("reading %q: %v", dir, err)
	}

	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		names = append(names, entry.Name())
	}

	slices.Sort(names)

	return names
}

func TestLibraryFolderCreatesTheFolder(t *testing.T) {
	app := newLibrary(t)
	app.root = filepath.Join(t.TempDir(), "documents")

	got, err := app.LibraryFolder()
	if err != nil {
		t.Fatalf("LibraryFolder: %v", err)
	}

	if got != app.root {
		t.Fatalf("LibraryFolder = %q, want %q", got, app.root)
	}

	info, err := os.Stat(got)
	if err != nil {
		t.Fatalf("stat %q: %v", got, err)
	}

	if !info.IsDir() {
		t.Fatalf("%q is not a directory", got)
	}

	// Calling it again on an existing folder is fine.
	if _, err := app.LibraryFolder(); err != nil {
		t.Fatalf("second LibraryFolder: %v", err)
	}
}

func TestWriteThenReadTreeRoundTripsExactBytes(t *testing.T) {
	app := newLibrary(t)

	tests := []struct {
		id        string
		contents  []byte
		thumbnail []byte
	}{
		{
			id:        "json",
			contents:  []byte(`{"version":1,"scene":{"components":[]}}`),
			thumbnail: []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff},
		},
		{
			id:        "binary-contents",
			contents:  []byte{0x00, 0x01, 0x7f, 0x80, 0xfe, 0xff, 0x0a, 0x0d},
			thumbnail: []byte{0x00},
		},
		{
			id:        "empty-contents",
			contents:  []byte{},
			thumbnail: []byte("preview"),
		},
		{
			id:       "utf8",
			contents: []byte("Baum — árbol — 木\n"),
		},
	}

	for _, test := range tests {
		t.Run(test.id, func(t *testing.T) {
			if err := app.WriteDocument(test.id, test.contents, test.thumbnail); err != nil {
				t.Fatalf("WriteDocument(%q): %v", test.id, err)
			}

			got, err := app.ReadDocument(test.id)
			if err != nil {
				t.Fatalf("ReadDocument(%q): %v", test.id, err)
			}

			if !bytes.Equal(got, test.contents) {
				t.Fatalf("ReadDocument(%q) = %v, want %v", test.id, got, test.contents)
			}

			gotThumbnail, err := app.ReadDocumentPicture(test.id)
			if err != nil {
				t.Fatalf("ReadDocumentPicture(%q): %v", test.id, err)
			}

			if !bytes.Equal(gotThumbnail, test.thumbnail) {
				t.Fatalf("ReadDocumentPicture(%q) = %v, want %v", test.id, gotThumbnail, test.thumbnail)
			}
		})
	}
}

func TestWriteTreeWithoutThumbnailWritesNoPreview(t *testing.T) {
	app := newLibrary(t)

	if err := app.WriteDocument("document", []byte(`{"document":1}`), nil); err != nil {
		t.Fatalf("WriteDocument: %v", err)
	}

	want := []string{"document.json"}
	if got := libraryEntries(t, app.root); !reflect.DeepEqual(got, want) {
		t.Fatalf("library holds %v, want %v", got, want)
	}
}

func TestReadTreeThumbnailWithoutPreviewReturnsNothing(t *testing.T) {
	app := newLibrary(t)

	if err := app.WriteDocument("document", []byte(`{"document":1}`), nil); err != nil {
		t.Fatalf("WriteDocument: %v", err)
	}

	got, err := app.ReadDocumentPicture("document")
	if err != nil {
		t.Fatalf("ReadDocumentPicture: %v", err)
	}

	if got != nil {
		t.Fatalf("ReadDocumentPicture returned %v, want nil", got)
	}
}

func TestListTreesReturnsNewestFirst(t *testing.T) {
	app := newLibrary(t)

	// Whole-hour modification times are set explicitly, so the order does not
	// depend on how quickly the files happened to be written.
	base := time.Date(2024, time.May, 1, 12, 0, 0, 0, time.UTC)

	documents := []struct {
		id       string
		contents []byte
		at       time.Time
	}{
		{id: "oldest", contents: []byte(`{"document":1}`), at: base},
		{id: "beta", contents: []byte(`{"document":2,"nodes":[]}`), at: base.Add(time.Hour)},
		{id: "alpha", contents: []byte(`{"document":3}`), at: base.Add(time.Hour)},
		{id: "newest", contents: []byte(`{"document":4,"nodes":[1],"scene":{}}`), at: base.Add(2 * time.Hour)},
	}

	type wantTree struct {
		size int64
		at   time.Time
	}

	wanted := make(map[string]wantTree, len(documents))
	for _, document := range documents {
		if err := app.WriteDocument(document.id, document.contents, nil); err != nil {
			t.Fatalf("WriteDocument(%q): %v", document.id, err)
		}

		path := filepath.Join(app.root, document.id+".json")
		if err := os.Chtimes(path, document.at, document.at); err != nil {
			t.Fatalf("Chtimes(%q): %v", path, err)
		}

		wanted[document.id] = wantTree{size: int64(len(document.contents)), at: document.at}
	}

	// Neither of these is a document: one is not JSON, the other is a directory
	// that happens to be named like one.
	if err := os.WriteFile(filepath.Join(app.root, "notes.txt"), []byte("not a document"), 0o644); err != nil {
		t.Fatalf("setup notes.txt: %v", err)
	}

	if err := os.Mkdir(filepath.Join(app.root, "backup.json"), 0o755); err != nil {
		t.Fatalf("setup backup.json: %v", err)
	}

	got, err := app.ListDocuments()
	if err != nil {
		t.Fatalf("ListDocuments: %v", err)
	}

	// "alpha" and "beta" share a modification time, so the id breaks the tie.
	wantIDs := []string{"newest", "alpha", "beta", "oldest"}

	gotIDs := make([]string, 0, len(got))
	for _, document := range got {
		gotIDs = append(gotIDs, document.ID)
	}

	if !reflect.DeepEqual(gotIDs, wantIDs) {
		t.Fatalf("ListDocuments ids = %v, want %v", gotIDs, wantIDs)
	}

	for _, document := range got {
		want := wanted[document.ID]

		if document.Size != want.size {
			t.Fatalf("ListDocuments %q size = %d, want %d", document.ID, document.Size, want.size)
		}

		savedAt, err := time.Parse(time.RFC3339, document.SavedAt)
		if err != nil {
			t.Fatalf("ListDocuments %q SavedAt = %q is not RFC3339: %v", document.ID, document.SavedAt, err)
		}

		if !savedAt.Equal(want.at) {
			t.Fatalf("ListDocuments %q SavedAt = %v, want %v", document.ID, savedAt, want.at)
		}
	}
}

func TestListTreesOnEmptyLibraryReturnsNoTrees(t *testing.T) {
	app := newLibrary(t)

	got, err := app.ListDocuments()
	if err != nil {
		t.Fatalf("ListDocuments: %v", err)
	}

	if len(got) != 0 {
		t.Fatalf("ListDocuments = %v, want no documents", got)
	}

	// An empty list, not nil: the frontend receives [] rather than null.
	if got == nil {
		t.Fatal("ListDocuments returned nil, want an empty list")
	}
}

func TestWriteTreeReplacesExistingTree(t *testing.T) {
	app := newLibrary(t)

	if err := app.WriteDocument("document", []byte("first"), []byte("first preview")); err != nil {
		t.Fatalf("first WriteDocument: %v", err)
	}

	if err := app.WriteDocument("document", []byte("second"), []byte("second preview")); err != nil {
		t.Fatalf("second WriteDocument: %v", err)
	}

	got, err := app.ReadDocument("document")
	if err != nil {
		t.Fatalf("ReadDocument: %v", err)
	}

	if string(got) != "second" {
		t.Fatalf("ReadDocument = %q, want %q", got, "second")
	}

	gotThumbnail, err := app.ReadDocumentPicture("document")
	if err != nil {
		t.Fatalf("ReadDocumentPicture: %v", err)
	}

	if string(gotThumbnail) != "second preview" {
		t.Fatalf("ReadDocumentPicture = %q, want %q", gotThumbnail, "second preview")
	}

	// The rename left exactly the two files behind, no temporary ones.
	want := []string{"document.json", "document.png"}
	if got := libraryEntries(t, app.root); !reflect.DeepEqual(got, want) {
		t.Fatalf("library holds %v, want %v", got, want)
	}
}

func TestDeleteTreeRemovesTreeAndPreview(t *testing.T) {
	app := newLibrary(t)

	if err := app.WriteDocument("document", []byte(`{"document":1}`), []byte("preview")); err != nil {
		t.Fatalf("WriteDocument: %v", err)
	}

	if err := app.DeleteDocument("document"); err != nil {
		t.Fatalf("DeleteDocument: %v", err)
	}

	if got := libraryEntries(t, app.root); len(got) != 0 {
		t.Fatalf("library still holds %v after deleting the document", got)
	}

	if _, err := app.ReadDocument("document"); !errors.Is(err, fs.ErrNotExist) {
		t.Fatalf("ReadDocument after delete error = %v, want %v", err, fs.ErrNotExist)
	}
}

func TestDeleteTreeReportsMissingTree(t *testing.T) {
	app := newLibrary(t)

	err := app.DeleteDocument("absent")
	if err == nil {
		t.Fatal("DeleteDocument of a missing document succeeded, want an error")
	}

	if !errors.Is(err, fs.ErrNotExist) {
		t.Fatalf("DeleteDocument error = %v, want an error matching %v", err, fs.ErrNotExist)
	}
}

func TestDeleteTreeToleratesMissingPreview(t *testing.T) {
	app := newLibrary(t)

	if err := app.WriteDocument("document", []byte(`{"document":1}`), []byte("preview")); err != nil {
		t.Fatalf("WriteDocument: %v", err)
	}

	if err := os.Remove(filepath.Join(app.root, "document.png")); err != nil {
		t.Fatalf("setup: removing the preview: %v", err)
	}

	if err := app.DeleteDocument("document"); err != nil {
		t.Fatalf("DeleteDocument with the preview already gone: %v", err)
	}

	if got := libraryEntries(t, app.root); len(got) != 0 {
		t.Fatalf("library still holds %v after deleting the document", got)
	}
}

func TestLibraryAcceptsValidTreeIDs(t *testing.T) {
	ids := []string{
		"a",
		"0",
		"document-1",
		"Document_2",
		strings.Repeat("a", 64),
	}

	for _, id := range ids {
		t.Run(id, func(t *testing.T) {
			app := newLibrary(t)

			if err := app.WriteDocument(id, []byte(`{"document":1}`), []byte("preview")); err != nil {
				t.Fatalf("WriteDocument(%q): %v", id, err)
			}

			got, err := app.ReadDocument(id)
			if err != nil {
				t.Fatalf("ReadDocument(%q): %v", id, err)
			}

			if string(got) != `{"document":1}` {
				t.Fatalf("ReadDocument(%q) = %q", id, got)
			}

			documents, err := app.ListDocuments()
			if err != nil {
				t.Fatalf("ListDocuments: %v", err)
			}

			if len(documents) != 1 || documents[0].ID != id {
				t.Fatalf("ListDocuments = %v, want the single document %q", documents, id)
			}

			if err := app.DeleteDocument(id); err != nil {
				t.Fatalf("DeleteDocument(%q): %v", id, err)
			}
		})
	}
}

func TestLibraryRejectsInvalidTreeIDs(t *testing.T) {
	app := newLibrary(t)

	ids := []struct {
		name string
		id   string
	}{
		{name: "empty", id: ""},
		{name: "whitespace", id: " "},
		{name: "parent directory", id: "../evil"},
		{name: "windows parent directory", id: `..\evil`},
		{name: "dot dot", id: ".."},
		{name: "forward slash", id: "a/b"},
		{name: "backslash", id: `a\b`},
		{name: "absolute path", id: `/etc/passwd`},
		{name: "space", id: "document one"},
		{name: "too long", id: strings.Repeat("a", 100)},
		{name: "one over the limit", id: strings.Repeat("a", 65)},
		{name: "leading dash", id: "-document"},
		{name: "leading underscore", id: "_document"},
		{name: "extension", id: "document.json"},
		{name: "dot", id: "."},
		{name: "null byte", id: "document\x00"},
	}

	operations := []struct {
		name string
		call func(id string) error
	}{
		{
			name: "WriteDocument",
			call: func(id string) error {
				return app.WriteDocument(id, []byte(`{"document":1}`), []byte("preview"))
			},
		},
		{
			name: "ReadDocument",
			call: func(id string) error {
				_, err := app.ReadDocument(id)
				return err
			},
		},
		{
			name: "DeleteDocument",
			call: func(id string) error {
				return app.DeleteDocument(id)
			},
		},
		{
			name: "ReadDocumentPicture",
			call: func(id string) error {
				_, err := app.ReadDocumentPicture(id)
				return err
			},
		},
	}

	for _, candidate := range ids {
		for _, operation := range operations {
			t.Run(operation.name+"/"+candidate.name, func(t *testing.T) {
				err := operation.call(candidate.id)
				if err == nil {
					t.Fatalf("%s(%q) succeeded, want an error", operation.name, candidate.id)
				}

				if !errors.Is(err, fsutil.ErrInvalidID) {
					t.Fatalf("%s(%q) error = %v, want %v", operation.name, candidate.id, err, fsutil.ErrInvalidID)
				}
			})
		}
	}

	// Nothing was written anywhere: not in the library, not beside it.
	if got := libraryEntries(t, app.root); len(got) != 0 {
		t.Fatalf("library holds %v after only refused ids", got)
	}

	strays := []string{
		filepath.Join(app.root, "evil.json"),
		filepath.Join(app.root, "evil.png"),
		filepath.Join(filepath.Dir(app.root), "evil.json"),
		filepath.Join(filepath.Dir(app.root), "evil.png"),
		filepath.Join(filepath.Dir(filepath.Dir(app.root)), "evil.json"),
	}

	for _, stray := range strays {
		if _, err := os.Stat(stray); !errors.Is(err, fs.ErrNotExist) {
			t.Fatalf("stat %q = %v, want the file not to exist", stray, err)
		}
	}
}

func TestWriteTreeReportsUnwritableLibrary(t *testing.T) {
	app := newLibrary(t)

	blocker := filepath.Join(t.TempDir(), "blocker")
	if err := os.WriteFile(blocker, []byte("not a directory"), 0o644); err != nil {
		t.Fatalf("setup: %v", err)
	}

	app.root = filepath.Join(blocker, "documents")

	if err := app.WriteDocument("document", []byte(`{"document":1}`), nil); err == nil {
		t.Fatal("WriteDocument into a library below a file succeeded, want an error")
	}

	if _, err := app.ListDocuments(); err == nil {
		t.Fatal("ListDocuments of a library below a file succeeded, want an error")
	}
}
