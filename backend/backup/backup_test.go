package backup

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	"wails-desktop-template/backend"
	"wails-desktop-template/backend/documents"
	"wails-desktop-template/backend/secrets"
)

// testApp is one computer: its library and its backups, with the library, the
// data folder and the holding folder all in fresh temporary folders.
type testApp struct {
	*Service
	*documents.Library
	data string
}

func newBackupApp(t *testing.T) *testApp {
	t.Helper()

	data := t.TempDir()
	shell := backend.Shell{DataFolder: func() (string, error) { return data, nil }, Emit: func(string, ...any) {}}
	library := documents.New(shell)
	app := &testApp{Service: New(shell, library, &secrets.Memory{}), Library: library, data: data}
	app.setFolder(t, t.TempDir())

	return app
}

// setFolder moves the library to folder, as a new computer or Settings would.
func (a *testApp) setFolder(t *testing.T, folder string) {
	t.Helper()

	if err := a.SetLibraryFolder(folder); err != nil {
		t.Fatal(err)
	}
}

// folder is where the library is now.
func (a *testApp) folder(t *testing.T) string {
	t.Helper()

	folder, err := a.LibraryFolder()
	if err != nil {
		t.Fatal(err)
	}

	return folder
}

// savedAtTime writes a document with a picture and sets its time saved.
func savedAtTime(t *testing.T, app *testApp, id string, at time.Time) {
	t.Helper()

	if err := app.WriteDocument(id, []byte(`{"name":"`+id+`"}`), []byte("png "+id)); err != nil {
		t.Fatal(err)
	}

	if err := os.Chtimes(filepath.Join(app.folder(t), id+".json"), at, at); err != nil {
		t.Fatal(err)
	}
}

// libraryEntries lists the names in dir, sorted.
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

// zipEntries lists the names in the zip at path, sorted.
func zipEntries(t *testing.T, path string) []string {
	t.Helper()

	archive, err := zip.OpenReader(path)
	if err != nil {
		t.Fatal(err)
	}
	defer archive.Close()

	names := []string{}
	for _, entry := range archive.File {
		names = append(names, entry.Name)
	}

	slices.Sort(names)

	return names
}

// writeZip makes a zip from name to contents, for backups the app didn't write.
func writeZip(t *testing.T, files map[string]string) string {
	t.Helper()

	var buffer bytes.Buffer

	archive := zip.NewWriter(&buffer)
	for name, contents := range files {
		writer, err := archive.Create(name)
		if err != nil {
			t.Fatal(err)
		}

		if _, err := writer.Write([]byte(contents)); err != nil {
			t.Fatal(err)
		}
	}

	if err := archive.Close(); err != nil {
		t.Fatal(err)
	}

	path := filepath.Join(t.TempDir(), "backup.zip")
	if err := os.WriteFile(path, buffer.Bytes(), 0o644); err != nil {
		t.Fatal(err)
	}

	return path
}

func TestABackupHoldsEveryPropAndPictureButNotTheBin(t *testing.T) {
	app := newBackupApp(t)
	savedAtTime(t, app, "oak", time.Now())
	savedAtTime(t, app, "pine", time.Now())
	savedAtTime(t, app, "gone", time.Now())

	if err := app.RemoveDocument("gone"); err != nil {
		t.Fatal(err)
	}

	if err := os.WriteFile(filepath.Join(app.folder(t), "notes.txt"), []byte("mine"), 0o644); err != nil {
		t.Fatal(err)
	}

	target := filepath.Join(t.TempDir(), "backup.zip")

	summary, err := app.BackUpToFile(target, []byte(`[{"name":"Forest"}]`), "0.4.0")
	if err != nil {
		t.Fatal(err)
	}

	if summary.Documents != 2 {
		t.Fatalf("summary = %+v, want 2 documents", summary)
	}

	want := []string{"backup.json", "documents/oak.json", "documents/oak.png", "documents/pine.json", "documents/pine.png", "extras.json"}
	if got := zipEntries(t, target); !slices.Equal(got, want) {
		t.Fatalf("zip holds %v, want %v", got, want)
	}
}

func TestABackupTakesTheAppsOwnFoldersToo(t *testing.T) {
	app := newBackupApp(t)

	looks := filepath.Join(app.folder(t), "looks")
	if err := os.MkdirAll(looks, 0o755); err != nil {
		t.Fatal(err)
	}

	if err := os.WriteFile(filepath.Join(looks, "autumn.json"), []byte(`{}`), 0o644); err != nil {
		t.Fatal(err)
	}

	target := filepath.Join(t.TempDir(), "backup.zip")
	if _, err := app.BackUpToFile(target, nil, "0.4.0"); err != nil {
		t.Fatal(err)
	}

	if got := zipEntries(t, target); !slices.Contains(got, "documents/looks/autumn.json") {
		t.Fatalf("zip holds %v, want the look", got)
	}
}

func TestBackingUpAndRestoringIntoAnEmptyFolderGivesTheSameProps(t *testing.T) {
	app := newBackupApp(t)
	saved := time.Date(2026, time.March, 3, 9, 30, 0, 0, time.UTC)
	savedAtTime(t, app, "oak", saved)

	target := filepath.Join(t.TempDir(), "backup.zip")
	if _, err := app.BackUpToFile(target, []byte(`extras`), "0.4.0"); err != nil {
		t.Fatal(err)
	}

	// A new computer: an empty saved documents folder.
	app.setFolder(t, t.TempDir())

	held, err := app.OpenBackupFile(target)
	if err != nil {
		t.Fatal(err)
	}

	if held.Extras != "extras" || held.App != "0.4.0" {
		t.Fatalf("held = %+v", held)
	}

	if len(held.Documents) != 1 || held.Documents[0].Status != "new" || !held.Documents[0].HasPicture {
		t.Fatalf("held documents = %+v", held.Documents)
	}

	restored, err := app.RestoreFromHolding([]RestoreChoice{{ID: "oak"}})
	if err != nil || restored != 1 {
		t.Fatalf("restored %d, %v", restored, err)
	}

	contents, _ := app.ReadDocument("oak")
	picture, _ := app.ReadDocumentPicture("oak")

	if string(contents) != `{"name":"oak"}` || string(picture) != "png oak" {
		t.Fatalf("document = %q, picture = %q", contents, picture)
	}

	documents, _ := app.ListDocuments()
	if len(documents) != 1 || documents[0].SavedAt != saved.Format(time.RFC3339) {
		t.Fatalf("restored documents = %+v, want saved at %s", documents, saved.Format(time.RFC3339))
	}
}

func TestOpeningABackupComparesItWithTheSavedProps(t *testing.T) {
	app := newBackupApp(t)
	savedAtTime(t, app, "same", time.Now())
	savedAtTime(t, app, "changed", time.Now())

	target := filepath.Join(t.TempDir(), "backup.zip")
	if _, err := app.BackUpToFile(target, nil, "0.4.0"); err != nil {
		t.Fatal(err)
	}

	if err := app.WriteDocument("changed", []byte(`{"name":"changed since"}`), nil); err != nil {
		t.Fatal(err)
	}

	if err := app.RemoveDocument("same"); err != nil {
		t.Fatal(err)
	}

	savedAtTime(t, app, "same", time.Now())

	held, err := app.OpenBackupFile(target)
	if err != nil {
		t.Fatal(err)
	}

	got := map[string]string{}
	for _, document := range held.Documents {
		got[document.ID] = document.Status
	}

	if got["same"] != "same" || got["changed"] != "different" {
		t.Fatalf("statuses = %v", got)
	}
}

func TestRestoringNeverReplacesASavedProp(t *testing.T) {
	app := newBackupApp(t)
	savedAtTime(t, app, "oak", time.Now())

	target := filepath.Join(t.TempDir(), "backup.zip")
	if _, err := app.BackUpToFile(target, nil, "0.4.0"); err != nil {
		t.Fatal(err)
	}

	if err := app.WriteDocument("oak", []byte(`{"name":"newer"}`), nil); err != nil {
		t.Fatal(err)
	}

	if _, err := app.OpenBackupFile(target); err != nil {
		t.Fatal(err)
	}

	if _, err := app.RestoreFromHolding([]RestoreChoice{{ID: "oak"}}); !errors.Is(err, documents.ErrAlreadyThere) {
		t.Fatalf("restoring over a different document = %v, want documents.ErrAlreadyThere", err)
	}

	restored, err := app.RestoreFromHolding([]RestoreChoice{{ID: "oak", CopyID: "oakbackup", CopyContents: `{"name":"oak (from backup)"}`}})
	if err != nil || restored != 1 {
		t.Fatalf("restoring as a copy = %d, %v", restored, err)
	}

	kept, _ := app.ReadDocument("oak")
	copied, _ := app.ReadDocument("oakbackup")
	picture, _ := app.ReadDocumentPicture("oakbackup")

	if string(kept) != `{"name":"newer"}` || string(copied) != `{"name":"oak (from backup)"}` || string(picture) != "png oak" {
		t.Fatalf("kept = %q, copy = %q, picture = %q", kept, copied, picture)
	}
}

func TestRestoringADocumentThatIsAlreadyHereDoesNothing(t *testing.T) {
	app := newBackupApp(t)
	savedAtTime(t, app, "oak", time.Now())

	target := filepath.Join(t.TempDir(), "backup.zip")
	if _, err := app.BackUpToFile(target, nil, "0.4.0"); err != nil {
		t.Fatal(err)
	}

	if _, err := app.OpenBackupFile(target); err != nil {
		t.Fatal(err)
	}

	restored, err := app.RestoreFromHolding([]RestoreChoice{{ID: "oak"}})
	if err != nil || restored != 0 {
		t.Fatalf("restored %d, %v, want nothing", restored, err)
	}
}

func TestRestoringBringsInMissingFilesFromTheAppsFolders(t *testing.T) {
	app := newBackupApp(t)

	path := writeZip(t, map[string]string{
		"backup.json":                 `{"format":1,"files":[]}`,
		"documents/looks/autumn.json": `{"look":1}`,
	})

	if _, err := app.OpenBackupFile(path); err != nil {
		t.Fatal(err)
	}

	if _, err := app.RestoreFromHolding(nil); err != nil {
		t.Fatal(err)
	}

	contents, err := os.ReadFile(filepath.Join(app.folder(t), "looks", "autumn.json"))
	if err != nil || string(contents) != `{"look":1}` {
		t.Fatalf("look = %q, %v", contents, err)
	}
}

func TestABackupFromANewerAppIsRefused(t *testing.T) {
	app := newBackupApp(t)
	path := writeZip(t, map[string]string{"backup.json": `{"format":2}`, "documents/oak.json": `{}`})

	if _, err := app.OpenBackupFile(path); !errors.Is(err, errNewerBackup) {
		t.Fatalf("OpenBackupFile = %v, want errNewerBackup", err)
	}
}

func TestAFileThatIsNotABackupIsRefused(t *testing.T) {
	app := newBackupApp(t)

	notZip := filepath.Join(t.TempDir(), "photo.zip")
	if err := os.WriteFile(notZip, []byte("not a zip"), 0o644); err != nil {
		t.Fatal(err)
	}

	for _, path := range []string{notZip, writeZip(t, map[string]string{"documents/oak.json": `{}`})} {
		if _, err := app.OpenBackupFile(path); !errors.Is(err, errNotABackup) {
			t.Fatalf("OpenBackupFile(%s) = %v, want errNotABackup", filepath.Base(path), err)
		}
	}
}

func TestABackupCannotWriteOutsideTheHoldingFolder(t *testing.T) {
	app := newBackupApp(t)

	for _, name := range []string{
		"documents/../escape.json",
		"documents/../../escape.json",
		"/documents/oak.json",
		"documents/C:/escape.json",
		`documents/sub\oak.json`,
		"documents/oak.exe",
		"documents/removed/oak.json",
		"elsewhere/oak.json",
	} {
		path := writeZip(t, map[string]string{"backup.json": `{"format":1}`, name: `{}`})

		if _, err := app.OpenBackupFile(path); !errors.Is(err, errNotABackup) {
			t.Fatalf("a backup holding %q opened: %v", name, err)
		}
	}

	if _, err := os.Stat(filepath.Join(filepath.Dir(app.data), "escape.json")); err == nil {
		t.Fatal("a file was written outside the holding folder")
	}
}

func TestAFailedBackupLeavesNoFile(t *testing.T) {
	app := newBackupApp(t)
	savedAtTime(t, app, "oak", time.Now())

	folder := t.TempDir()

	if _, err := app.BackUpToFile(filepath.Join(folder, "missing", "backup.zip"), nil, "0.4.0"); err == nil {
		t.Fatal("writing into a missing folder succeeded")
	}

	if entries := libraryEntries(t, folder); len(entries) != 0 {
		t.Fatalf("the folder holds %v after a failed backup", entries)
	}
}

func TestClearingTheHoldingFolderRemovesWhatWasHeld(t *testing.T) {
	app := newBackupApp(t)
	savedAtTime(t, app, "oak", time.Now())

	target := filepath.Join(t.TempDir(), "backup.zip")
	if _, err := app.BackUpToFile(target, nil, "0.4.0"); err != nil {
		t.Fatal(err)
	}

	if _, err := app.OpenBackupFile(target); err != nil {
		t.Fatal(err)
	}

	app.ClearHolding()

	holding, _ := app.holdingDir()
	if _, err := os.Stat(holding); err == nil {
		t.Fatal("the holding folder is still there")
	}
}

func TestTheManifestSaysWhatTheBackupHolds(t *testing.T) {
	app := newBackupApp(t)
	savedAtTime(t, app, "oak", time.Date(2026, time.March, 3, 9, 30, 0, 0, time.UTC))

	target := filepath.Join(t.TempDir(), "backup.zip")
	if _, err := app.BackUpToFile(target, nil, "0.4.0"); err != nil {
		t.Fatal(err)
	}

	archive, err := zip.OpenReader(target)
	if err != nil {
		t.Fatal(err)
	}
	defer archive.Close()

	manifest, err := readBackupManifest(&archive.Reader)
	if err != nil {
		t.Fatal(err)
	}

	if manifest.Format != backupFormat || manifest.App != "0.4.0" || len(manifest.Files) != 2 {
		t.Fatalf("manifest = %+v", manifest)
	}

	oak := manifest.Files[0]
	if oak.Path != "oak.json" || oak.SavedAt != "2026-03-03T09:30:00Z" || len(oak.SHA256) != 64 {
		t.Fatalf("oak = %+v", oak)
	}

	written, _ := json.Marshal(manifest)
	if strings.Contains(string(written), "removed") {
		t.Fatalf("the manifest mentions Recently removed: %s", written)
	}
}

func TestThePictureHandlerServesPicturesInABackupBeingRestored(t *testing.T) {
	app := newBackupApp(t)
	savedAtTime(t, app, "oak", time.Now())

	target := filepath.Join(t.TempDir(), "backup.zip")
	if _, err := app.BackUpToFile(target, nil, "0.4.0"); err != nil {
		t.Fatal(err)
	}

	if _, err := app.OpenBackupFile(target); err != nil {
		t.Fatal(err)
	}

	recorder := httptest.NewRecorder()
	HeldPictureHandler(app.Service).ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, HeldPicturePrefix+"oak.png", nil))

	if recorder.Code != http.StatusOK || recorder.Body.String() != "png oak" {
		t.Fatalf("status = %d, body = %q", recorder.Code, recorder.Body.String())
	}
}
