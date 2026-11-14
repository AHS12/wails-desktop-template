package documents

// What the Storage settings page asks about the library folder, and the
// interface's index of what each saved document is.

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"wails-desktop-template/backend/fsutil"
)

// LibraryInfo describes the library folder for the Storage settings page.
type LibraryInfo struct {
	Folder    string `json:"folder"`
	Documents int    `json:"documents"`
	Bytes     int64  `json:"bytes"`
}

// SetLibraryFolder points the library at another folder, creating it if needed.
// Documents already saved stay where they are. An empty folder returns to the default.
func (l *Library) SetLibraryFolder(folder string) error {
	if folder != "" {
		if err := os.MkdirAll(folder, 0o755); err != nil {
			return fmt.Errorf("cannot use the folder %q: %w", folder, err)
		}
	}

	l.mu.Lock()
	l.root = folder
	l.mu.Unlock()

	return nil
}

// GetLibraryInfo returns where documents are saved, how many there are, and the
// space they and their pictures use.
func (l *Library) GetLibraryInfo() (LibraryInfo, error) {
	dir, err := l.libraryDir()
	if err != nil {
		return LibraryInfo{}, err
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return LibraryInfo{}, fmt.Errorf("cannot read the library folder %q: %w", dir, err)
	}

	info := LibraryInfo{Folder: dir}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		details, err := entry.Info()
		if err != nil {
			continue
		}

		info.Bytes += details.Size()

		if strings.HasSuffix(entry.Name(), JSONSuffix) {
			info.Documents++
		}
	}

	return info, nil
}

// OpenLibraryFolder shows the library folder in the system's file manager.
func (l *Library) OpenLibraryFolder() error {
	dir, err := l.libraryDir()
	if err != nil {
		return err
	}

	return fsutil.ShowFolder(dir)
}

// WriteDocumentsIndex stores the interface's index of saved documents.
func (l *Library) WriteDocumentsIndex(contents []byte) error {
	path, err := l.indexPath()
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("cannot create the folder %q: %w", filepath.Dir(path), err)
	}

	return fsutil.WriteAtomic(path, contents)
}

// ReadDocumentsIndex returns the index of saved documents. A missing one is not
// an error: it returns nil, nil, and the interface builds it again.
func (l *Library) ReadDocumentsIndex() ([]byte, error) {
	path, err := l.indexPath()
	if err != nil {
		return nil, err
	}

	return fsutil.ReadIfThere(path)
}

// indexPath is the index's place in the data folder, outside the library, so
// it is never backed up or listed as a document.
func (l *Library) indexPath() (string, error) {
	data, err := l.shell.DataFolder()
	if err != nil {
		return "", err
	}

	return filepath.Join(data, indexFileName), nil
}
