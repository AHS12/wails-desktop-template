package backup

import (
	"os"
	"path/filepath"
	"slices"
	"testing"
	"time"
)

func TestTheFingerprintChangesOnlyWhenADocumentDoes(t *testing.T) {
	app := newBackupApp(t)
	savedAtTime(t, app, "oak", time.Date(2026, time.March, 1, 9, 0, 0, 0, time.UTC))

	first, err := app.LibraryFingerprint()
	if err != nil {
		t.Fatal(err)
	}

	again, _ := app.LibraryFingerprint()
	if again != first {
		t.Fatal("the fingerprint changed with nothing saved")
	}

	if err := app.WriteDocument("oak", []byte(`{"name":"changed"}`), nil); err != nil {
		t.Fatal(err)
	}

	saved, _ := app.LibraryFingerprint()
	if saved == first {
		t.Fatal("saving a document left the fingerprint the same")
	}

	if err := app.RemoveDocument("oak"); err != nil {
		t.Fatal(err)
	}

	removed, _ := app.LibraryFingerprint()
	if removed == saved {
		t.Fatal("removing a document left the fingerprint the same")
	}
}

func TestPruningKeepsTheNewestBackupsAndNothingElseIsTouched(t *testing.T) {
	app := newBackupApp(t)
	folder := t.TempDir()

	names := []string{
		"wails-desktop-template-backup-2026-10-01.zip",
		"wails-desktop-template-backup-2026-10-03.zip",
		"wails-desktop-template-backup-2026-10-02.zip",
		"wails-desktop-template-backup-2026-10-04.zip",
		"wails-desktop-template-backup-mine.zip",
		"holiday photos.zip",
		"wails-desktop-template-backup-2026-10-01.zip.txt",
	}

	for _, name := range names {
		if err := os.WriteFile(filepath.Join(folder, name), []byte("x"), 0o644); err != nil {
			t.Fatal(err)
		}
	}

	removed, err := app.PruneFolderBackups(folder, 2)
	if err != nil || removed != 2 {
		t.Fatalf("removed %d, %v", removed, err)
	}

	want := []string{
		"wails-desktop-template-backup-2026-10-01.zip.txt",
		"wails-desktop-template-backup-2026-10-03.zip",
		"wails-desktop-template-backup-2026-10-04.zip",
		"wails-desktop-template-backup-mine.zip",
		"holiday photos.zip",
	}
	// Listed by name, wherever the app's name sorts.
	slices.Sort(want)

	if got := libraryEntries(t, folder); !slices.Equal(got, want) {
		t.Fatalf("folder holds %v, want %v", got, want)
	}
}

func TestPruningAlwaysKeepsAtLeastOne(t *testing.T) {
	app := newBackupApp(t)
	folder := t.TempDir()

	if err := os.WriteFile(filepath.Join(folder, "wails-desktop-template-backup-2026-10-01.zip"), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}

	if removed, err := app.PruneFolderBackups(folder, 0); err != nil || removed != 0 {
		t.Fatalf("removed %d, %v", removed, err)
	}
}

func TestAMissingFolderIsNotThere(t *testing.T) {
	app := newBackupApp(t)

	if app.FolderExists(filepath.Join(t.TempDir(), "unplugged")) || app.FolderExists("") {
		t.Fatal("a missing folder was said to be there")
	}

	if !app.FolderExists(t.TempDir()) {
		t.Fatal("a folder that is there was said to be missing")
	}
}
