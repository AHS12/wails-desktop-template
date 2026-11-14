// Package export writes the files an export makes. What they hold is the
// frontend's business; this only makes sure they land in the chosen folder and
// nowhere else, and says which are already there.
package export

import (
	"errors"
	"os"
	"path/filepath"
	"strings"

	"wails-desktop-template/backend/fsutil"
)

// ExportFile is one file of an export. What it holds is the frontend's business.
type ExportFile struct {
	Name     string `json:"name"`
	Contents []byte `json:"contents"`
}

// Files is the export service.
type Files struct{}

// New makes the export service.
func New() *Files {
	return &Files{}
}

var errNoFolder = errors.New("no folder given")

func checkFolder(folder string) error {
	if strings.TrimSpace(folder) == "" {
		return errNoFolder
	}

	return nil
}

// WriteFiles writes files into folder, creating it if needed. A name is a plain
// file name and never a path, so an export cannot write outside its folder.
// Every name is checked before anything is written.
func (f *Files) WriteFiles(folder string, files []ExportFile) error {
	if err := checkFolder(folder); err != nil {
		return err
	}

	for _, file := range files {
		if err := fsutil.CheckFileName(file.Name); err != nil {
			return err
		}
	}

	if err := os.MkdirAll(folder, 0o755); err != nil {
		return err
	}

	for _, file := range files {
		if err := os.WriteFile(filepath.Join(folder, file.Name), file.Contents, 0o644); err != nil {
			return err
		}
	}

	return nil
}

// ExistingFiles returns which of names are already in folder, so an export can ask
// before replacing them. A folder that doesn't exist yet has none. The checks match
// WriteFiles, so it can't be used to look outside the folder.
func (f *Files) ExistingFiles(folder string, names []string) ([]string, error) {
	if err := checkFolder(folder); err != nil {
		return nil, err
	}

	for _, name := range names {
		if err := fsutil.CheckFileName(name); err != nil {
			return nil, err
		}
	}

	found := []string{}

	for _, name := range names {
		info, err := os.Stat(filepath.Join(folder, name))
		if err == nil && !info.IsDir() {
			found = append(found, name)
		}
	}

	return found, nil
}
