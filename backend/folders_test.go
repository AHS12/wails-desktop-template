package backend

import (
	"os"
	"path/filepath"
	"testing"
)

// Only the refusals are tested: a folder that is there would open a real window.
func TestShowFolderRefusesWhatIsNotAFolder(t *testing.T) {
	app := NewApp()
	root := t.TempDir()
	file := filepath.Join(root, "oak_01_LOD0.glb")

	if err := os.WriteFile(file, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}

	for _, path := range []string{"", "  ", file, filepath.Join(root, "missing")} {
		if err := app.ShowFolder(path); err == nil {
			t.Fatalf("ShowFolder accepted %q", path)
		}
	}
}

func TestChooseFolderBeforeStartupIsAnError(t *testing.T) {
	if _, err := NewApp().ChooseFolder("Export", ""); err == nil {
		t.Fatal("ChooseFolder succeeded before Startup; it must report an error")
	}
}
