package fsutil

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestTheFileManagerGetsAPathItCanRead(t *testing.T) {
	_, got := FileManagerCommand(`K:\Games\notes/spring/`)
	want := filepath.Clean(`K:\Games\notes/spring`)

	if got != want {
		t.Fatalf("path = %q, want %q", got, want)
	}

	// Explorer opens Documents for a path with forward slashes in it.
	if os.PathSeparator == '\\' && got != `K:\Games\notes\spring` {
		t.Fatalf("path = %q, want backslashes only", got)
	}
}

func TestWriteAtomicReplacesTheFileAndLeavesNothingElse(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "note.json")

	for _, contents := range []string{"first", "second"} {
		if err := WriteAtomic(path, []byte(contents)); err != nil {
			t.Fatal(err)
		}
	}

	got, err := os.ReadFile(path)
	if err != nil || string(got) != "second" {
		t.Fatalf("read %q, %v", got, err)
	}

	entries, _ := os.ReadDir(dir)
	if len(entries) != 1 {
		t.Fatalf("folder holds %d files, want only the note", len(entries))
	}
}

func TestWriteAtomicReportsAFolderThatIsNotThere(t *testing.T) {
	if err := WriteAtomic(filepath.Join(t.TempDir(), "missing", "note.json"), []byte("x")); err == nil {
		t.Fatal("wrote into a folder that does not exist")
	}
}

func TestReadIfThereTreatsAMissingFileAsNothing(t *testing.T) {
	contents, err := ReadIfThere(filepath.Join(t.TempDir(), "none.json"))
	if contents != nil || err != nil {
		t.Fatalf("got %q, %v", contents, err)
	}
}

func TestIDsThatCanNameAFileAreAccepted(t *testing.T) {
	for _, id := range []string{"a", "d1x9", "my_note-2", strings.Repeat("a", 64)} {
		if err := CheckID(id); err != nil {
			t.Errorf("%q: %v", id, err)
		}
	}
}

func TestIDsThatCouldLeaveTheFolderAreRefused(t *testing.T) {
	for _, id := range []string{"", "..", "../x", `a\b`, "a/b", "-a", "a.json", "a b", strings.Repeat("a", 65), "C:"} {
		if err := CheckID(id); !errors.Is(err, ErrInvalidID) {
			t.Errorf("%q: %v, want ErrInvalidID", id, err)
		}
	}
}

func TestFileNamesThatArePathsAreRefused(t *testing.T) {
	for _, name := range []string{"", ".", "..", "a/b", "../a.txt"} {
		if CheckFileName(name) == nil {
			t.Errorf("%q was accepted", name)
		}
	}

	if err := CheckFileName("note.md"); err != nil {
		t.Fatal(err)
	}
}
