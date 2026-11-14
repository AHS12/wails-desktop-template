package documents

// The library is the folder of documents the user owns: one JSON file per
// document, plus an optional PNG picture beside it.
//
// Go stays out of the contents. A document is bytes, and its name is its id;
// nothing here parses or validates one. What this file does own is the folder
// itself, and therefore the rule that an id can only ever name a file inside it.

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"

	"wails-desktop-template/backend"
	"wails-desktop-template/backend/fsutil"
)

// DocumentFile is one file in the library, as the library page lists it. It
// describes a file, not a document: the size is the size on disk and the time
// is the file's modification time.
type DocumentFile struct {
	ID         string `json:"id"`
	SavedAt    string `json:"savedAt"` // RFC3339 of the file's modification time
	Size       int64  `json:"size"`
	HasPicture bool   `json:"hasPicture"`
}

const (
	// FolderName is the library inside the app's data folder, until someone
	// picks another folder in Settings.
	FolderName = "documents"

	// JSONSuffix ends the file holding a document.
	JSONSuffix = ".json"

	// PictureSuffix ends the picture beside it.
	PictureSuffix = ".png"

	// indexFileName names the interface's index of saved documents, kept in the
	// data folder. It is a shortcut the interface can rebuild, never the truth.
	indexFileName = "documents-index.json"
)

// Library is the service that owns the folder of saved documents.
type Library struct {
	shell backend.Shell

	// mu guards root, which Settings can change while a listing is under way.
	mu sync.Mutex

	// root is the folder picked in Settings, or empty for FolderName inside the
	// data folder. Tests set it to a scratch folder.
	root string
}

// New makes the library service. Its data lives in the folder shell names.
func New(shell backend.Shell) *Library {
	return &Library{shell: shell}
}

// LibraryFolder returns the folder every saved document lives in, creating it if
// it is missing.
func (l *Library) LibraryFolder() (string, error) {
	return l.libraryDir()
}

// ListDocuments returns one entry per document file, newest modification time first.
// Ties are broken by id so the library page order is stable. Directories and
// anything not ending in ".json" are not documents and are left out.
func (l *Library) ListDocuments() ([]DocumentFile, error) {
	dir, err := l.libraryDir()
	if err != nil {
		return nil, err
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("cannot read the library folder %q: %w", dir, err)
	}

	// The modification time decides the order but is too coarse to recover from
	// SavedAt, so it is carried beside the entry until the sort is done.
	type found struct {
		document DocumentFile
		modTime  time.Time
	}

	// Knowing which pictures exist from the listing saves reading any of them
	// just to find out they are missing.
	pictures := make(map[string]bool)
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), PictureSuffix) {
			pictures[strings.TrimSuffix(entry.Name(), PictureSuffix)] = true
		}
	}

	foundTrees := make([]found, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), JSONSuffix) {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			// A file deleted between the listing and the stat is simply gone;
			// any other failure is worth reporting.
			if errors.Is(err, fs.ErrNotExist) {
				continue
			}

			return nil, fmt.Errorf("cannot inspect %q: %w", entry.Name(), err)
		}

		id := strings.TrimSuffix(entry.Name(), JSONSuffix)
		foundTrees = append(foundTrees, found{
			document: DocumentFile{
				ID:         id,
				SavedAt:    info.ModTime().UTC().Format(time.RFC3339),
				Size:       info.Size(),
				HasPicture: pictures[id],
			},
			modTime: info.ModTime(),
		})
	}

	slices.SortFunc(foundTrees, func(left, right found) int {
		if !left.modTime.Equal(right.modTime) {
			return right.modTime.Compare(left.modTime)
		}

		return strings.Compare(left.document.ID, right.document.ID)
	})

	documents := make([]DocumentFile, 0, len(foundTrees))
	for _, document := range foundTrees {
		documents = append(documents, document.document)
	}

	return documents, nil
}

// ReadDocument returns the bytes of the document file named by id. The contents are not
// inspected; parsing is the frontend's job, as with ReadFile.
func (l *Library) ReadDocument(id string) ([]byte, error) {
	path, err := l.path(id, JSONSuffix)
	if err != nil {
		return nil, err
	}

	return os.ReadFile(path)
}

// WriteDocument writes the document file named by id, replacing any existing one, and
// writes thumbnail as its PNG picture when thumbnail is non-empty. Both are
// written to a temporary file and renamed into place, so a crash mid-write
// cannot leave a half file behind under the document's name.
//
// An empty thumbnail writes no picture at all; an existing one is left as it
// is. Bytes are written as given: Go does not know or care what they describe.
func (l *Library) WriteDocument(id string, contents []byte, thumbnail []byte) error {
	path, err := l.path(id, JSONSuffix)
	if err != nil {
		return err
	}

	if err := fsutil.WriteAtomic(path, contents); err != nil {
		return err
	}

	if len(thumbnail) == 0 {
		return nil
	}

	picture, err := l.path(id, PictureSuffix)
	if err != nil {
		return err
	}

	return fsutil.WriteAtomic(picture, thumbnail)
}

// WriteDocumentPicture writes only the picture of the document named by id. The document
// file is left alone, so drawing a missing picture doesn't change when the document
// was last saved, or its place in the list.
func (l *Library) WriteDocumentPicture(id string, picture []byte) error {
	if len(picture) == 0 {
		return fmt.Errorf("refusing to write an empty picture for %q", id)
	}

	path, err := l.path(id, PictureSuffix)
	if err != nil {
		return err
	}

	return fsutil.WriteAtomic(path, picture)
}

// ShowDocument shows the document's file, picked out, in the system's file manager.
func (l *Library) ShowDocument(id string) error {
	path, err := l.path(id, JSONSuffix)
	if err != nil {
		return err
	}

	if _, err := os.Stat(path); err != nil {
		return fmt.Errorf("cannot show %q: %w", id, err)
	}

	return fsutil.Reveal(path)
}

// DeleteDocument removes the document file named by id and its picture. A picture that
// is already gone is not an error, but a document that is gone is: there is
// nothing to delete and the library page is out of date.
func (l *Library) DeleteDocument(id string) error {
	path, err := l.path(id, JSONSuffix)
	if err != nil {
		return err
	}

	if err := os.Remove(path); err != nil {
		return fmt.Errorf("cannot delete document %q: %w", id, err)
	}

	picture := strings.TrimSuffix(path, JSONSuffix) + PictureSuffix
	if err := os.Remove(picture); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return fmt.Errorf("cannot delete the picture of document %q: %w", id, err)
	}

	return nil
}

// ReadDocumentPicture returns the PNG picture of the document named by id. A document
// with no picture is not an error: it returns nil, nil so the library page can show
// a placeholder instead of reporting a failure.
func (l *Library) ReadDocumentPicture(id string) ([]byte, error) {
	path, err := l.path(id, PictureSuffix)
	if err != nil {
		return nil, err
	}

	contents, err := os.ReadFile(path)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}

	return contents, nil
}

// libraryDir returns the library folder, creating it if it is missing.
func (l *Library) libraryDir() (string, error) {
	l.mu.Lock()
	root := l.root
	l.mu.Unlock()

	if root == "" {
		data, err := l.shell.DataFolder()
		if err != nil {
			return "", err
		}

		root = filepath.Join(data, FolderName)
	}

	if err := os.MkdirAll(root, 0o755); err != nil {
		return "", fmt.Errorf("cannot create the library folder %q: %w", root, err)
	}

	return root, nil
}

// path returns the path of the file named id with the given suffix, or the
// error explaining why the id cannot name a file at all. Validating every id
// here is what makes the library refuse to read or write outside its folder.
func (l *Library) path(id string, suffix string) (string, error) {
	if err := fsutil.CheckID(id); err != nil {
		return "", err
	}

	dir, err := l.libraryDir()
	if err != nil {
		return "", err
	}

	return filepath.Join(dir, id+suffix), nil
}
