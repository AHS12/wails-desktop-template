package documents

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLibraryInfoCountsDocumentsAndBytes(t *testing.T) {
	app := newLibrary(t)

	if err := os.WriteFile(filepath.Join(app.root, "shop.json"), []byte("12345"), 0o644); err != nil {
		t.Fatal(err)
	}

	if err := os.WriteFile(filepath.Join(app.root, "shop.png"), []byte("123"), 0o644); err != nil {
		t.Fatal(err)
	}

	info, err := app.GetLibraryInfo()
	if err != nil {
		t.Fatal(err)
	}

	if info.Documents != 1 || info.Bytes != 8 {
		t.Fatalf("got %+v", info)
	}
}

func TestSetLibraryFolderCreatesAndUsesIt(t *testing.T) {
	app := newLibrary(t)
	folder := filepath.Join(t.TempDir(), "notes")

	if err := app.SetLibraryFolder(folder); err != nil {
		t.Fatal(err)
	}

	got, err := app.LibraryFolder()
	if err != nil || got != folder {
		t.Fatalf("got %q, %v", got, err)
	}
}

func TestTheDefaultLibraryIsInTheDataFolder(t *testing.T) {
	app := newLibrary(t)
	app.root = ""

	got, err := app.LibraryFolder()
	if err != nil {
		t.Fatal(err)
	}

	data, _ := app.shell.DataFolder()
	if got != filepath.Join(data, FolderName) {
		t.Fatalf("library = %q, want %q inside %q", got, FolderName, data)
	}
}

func TestTheIndexStaysOutOfTheLibrary(t *testing.T) {
	app := newLibrary(t)

	if err := app.WriteDocumentsIndex([]byte(`{"version":1}`)); err != nil {
		t.Fatal(err)
	}

	if entries := libraryEntries(t, app.root); len(entries) != 0 {
		t.Fatalf("the library holds %v", entries)
	}
}
