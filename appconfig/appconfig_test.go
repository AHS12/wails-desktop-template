package appconfig

import (
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

const root = ".."

func TestTheBuildFilesAgreeWithTheConfig(t *testing.T) {
	problems, err := Check(root, Current())
	if err != nil {
		t.Fatal(err)
	}

	if len(problems) > 0 {
		t.Fatalf("run `make version` or `make rename`:\n%s", strings.Join(problems, "\n"))
	}
}

func TestADriftedFileIsFoundAndPutRight(t *testing.T) {
	copyRoot := t.TempDir()

	for _, r := range Rules {
		data, err := os.ReadFile(filepath.Join(root, r.File))
		if err != nil {
			t.Fatal(err)
		}

		target := filepath.Join(copyRoot, r.File)

		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			t.Fatal(err)
		}

		if err := os.WriteFile(target, data, 0o644); err != nil {
			t.Fatal(err)
		}
	}

	renamed := Current()
	renamed.Name, renamed.ID, renamed.BundleID, renamed.Version = "My App", "my-app", "com.me.myapp", "2.0.0"

	problems, err := Check(copyRoot, renamed)
	if err != nil {
		t.Fatal(err)
	}

	if len(problems) == 0 {
		t.Fatal("a different name and version went unnoticed")
	}

	if err := Apply(copyRoot, renamed); err != nil {
		t.Fatal(err)
	}

	if problems, _ := Check(copyRoot, renamed); len(problems) > 0 {
		t.Fatalf("still different after writing:\n%s", strings.Join(problems, "\n"))
	}
}

func TestAConfigWithABadFieldIsRefused(t *testing.T) {
	for _, change := range []func(*Config){
		func(c *Config) { c.Name = "" },
		func(c *Config) { c.ID = "My App" },
		func(c *Config) { c.BundleID = "myapp" },
		func(c *Config) { c.Repository = "no-owner" },
		func(c *Config) { c.Version = "v1" },
	} {
		config := Current()
		change(&config)

		if config.Validate() == nil {
			t.Errorf("accepted %+v", config)
		}
	}
}

// PLAN.md says where the template came from, so it keeps the name.
var stillAboutTheOldApp = map[string]bool{"PLAN.md": true}

func TestNothingStillUsesTheOldName(t *testing.T) {
	output, err := exec.Command("git", "-C", root, "ls-files", "-z").Output()
	if err != nil {
		t.Skip("git isn't available:", err)
	}

	for _, file := range strings.Split(strings.TrimRight(string(output), "\x00"), "\x00") {
		if stillAboutTheOldApp[file] {
			continue
		}

		data, err := os.ReadFile(filepath.Join(root, file))
		if err != nil || bytes.IndexByte(data, 0) >= 0 {
			continue
		}

		// Written in parts, so this file doesn't find itself.
		for _, old := range []string{"easy" + "-props", "easy" + "props", "EASY" + "_PROPS"} {
			if bytes.Contains(data, []byte(old)) {
				t.Errorf("%s still says %q", file, old)
			}
		}
	}
}
