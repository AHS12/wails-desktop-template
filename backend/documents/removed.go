package documents

// Recently removed: a "removed" folder inside the library, so removing a
// document can be undone. A removed document keeps its file and picture as they
// were, time saved included, so putting it back puts back exactly what was there.
// When it was removed is kept beside it in a small file of its own, since the
// document's own time has to stay the time it was saved.

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"wails-desktop-template/backend/fsutil"
)

const (
	// RemovedFolder is Recently removed, inside the library. ListDocuments skips
	// folders, so nothing in it is ever listed as a saved document.
	RemovedFolder = "removed"

	// removedAtSuffix ends the file holding when a document was removed.
	removedAtSuffix = ".removed"

	// binKeepsFor is how long a removed document waits before it's gone for good.
	binKeepsFor = 30 * 24 * time.Hour
)

// RemovedDocument is one document in Recently removed.
type RemovedDocument struct {
	ID         string `json:"id"`
	SavedAt    string `json:"savedAt"`
	RemovedAt  string `json:"removedAt"`
	Size       int64  `json:"size"`
	HasPicture bool   `json:"hasPicture"`
}

// ErrAlreadyThere reports a put back that would replace a saved document.
var ErrAlreadyThere = errors.New("a saved document already has this id")

// RemoveDocument moves a saved document and its picture into Recently removed.
func (l *Library) RemoveDocument(id string) error {
	return l.removeDocument(id, time.Now())
}

func (l *Library) removeDocument(id string, now time.Time) error {
	from, err := l.path(id, JSONSuffix)
	if err != nil {
		return err
	}

	folder, err := l.removedDir()
	if err != nil {
		return err
	}

	if _, err := os.Stat(from); err != nil {
		return fmt.Errorf("cannot remove %q: %w", id, err)
	}

	// When first, so a document in Recently removed always says when it got there.
	if err := fsutil.WriteAtomic(filepath.Join(folder, id+removedAtSuffix), []byte(now.UTC().Format(time.RFC3339))); err != nil {
		return err
	}

	if err := moveFile(from, filepath.Join(folder, id+JSONSuffix)); err != nil {
		return err
	}

	return moveIfThere(strings.TrimSuffix(from, JSONSuffix)+PictureSuffix, filepath.Join(folder, id+PictureSuffix))
}

// PutBackDocument moves a document from Recently removed back among the saved documents.
func (l *Library) PutBackDocument(id string) error {
	to, err := l.path(id, JSONSuffix)
	if err != nil {
		return err
	}

	if _, err := os.Stat(to); err == nil {
		return fmt.Errorf("%w: %q", ErrAlreadyThere, id)
	}

	folder, err := l.removedDir()
	if err != nil {
		return err
	}

	if err := moveFile(filepath.Join(folder, id+JSONSuffix), to); err != nil {
		return err
	}

	if err := moveIfThere(filepath.Join(folder, id+PictureSuffix), strings.TrimSuffix(to, JSONSuffix)+PictureSuffix); err != nil {
		return err
	}

	return removeIfThere(filepath.Join(folder, id+removedAtSuffix))
}

// ForgetRemovedDocument removes a document in Recently removed for good.
func (l *Library) ForgetRemovedDocument(id string) error {
	if err := fsutil.CheckID(id); err != nil {
		return err
	}

	folder, err := l.removedDir()
	if err != nil {
		return err
	}

	if err := os.Remove(filepath.Join(folder, id+JSONSuffix)); err != nil {
		return fmt.Errorf("cannot remove %q for good: %w", id, err)
	}

	if err := removeIfThere(filepath.Join(folder, id+PictureSuffix)); err != nil {
		return err
	}

	return removeIfThere(filepath.Join(folder, id+removedAtSuffix))
}

// ListRemovedDocuments returns the documents in Recently removed, most recently removed first.
func (l *Library) ListRemovedDocuments() ([]RemovedDocument, error) {
	folder, err := l.removedDir()
	if err != nil {
		return nil, err
	}

	entries, err := os.ReadDir(folder)
	if err != nil {
		return nil, fmt.Errorf("cannot read Recently removed %q: %w", folder, err)
	}

	names := make(map[string]bool, len(entries))
	for _, entry := range entries {
		names[entry.Name()] = true
	}

	removed := []RemovedDocument{}
	for _, entry := range entries {
		id, isProp := strings.CutSuffix(entry.Name(), JSONSuffix)
		if entry.IsDir() || !isProp || fsutil.CheckID(id) != nil {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			continue
		}

		removed = append(removed, RemovedDocument{
			ID:         id,
			SavedAt:    info.ModTime().UTC().Format(time.RFC3339),
			RemovedAt:  removedAt(filepath.Join(folder, id+removedAtSuffix), info.ModTime()).UTC().Format(time.RFC3339),
			Size:       info.Size(),
			HasPicture: names[id+PictureSuffix],
		})
	}

	// RFC3339 in UTC sorts as text in time order.
	slices.SortFunc(removed, func(left, right RemovedDocument) int {
		if order := strings.Compare(right.RemovedAt, left.RemovedAt); order != 0 {
			return order
		}

		return strings.Compare(left.ID, right.ID)
	})

	return removed, nil
}

// ReadRemovedDocument returns the bytes of a document in Recently removed, so Recently removed can say
// what each one is. As with ReadDocument, the contents are not inspected.
func (l *Library) ReadRemovedDocument(id string) ([]byte, error) {
	if err := fsutil.CheckID(id); err != nil {
		return nil, err
	}

	folder, err := l.removedDir()
	if err != nil {
		return nil, err
	}

	return os.ReadFile(filepath.Join(folder, id+JSONSuffix))
}

// CopyDocumentPicture gives the document named to a copy of from's picture. A document
// without a picture is not an error: the copy gets one drawn later.
func (l *Library) CopyDocumentPicture(from string, to string) error {
	source, err := l.path(from, PictureSuffix)
	if err != nil {
		return err
	}

	target, err := l.path(to, PictureSuffix)
	if err != nil {
		return err
	}

	picture, err := os.ReadFile(source)
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}

	if err != nil {
		return err
	}

	return fsutil.WriteAtomic(target, picture)
}

// ForgetOldRemovedDocuments empties Recently removed of anything removed more than 30 days
// ago. The interface calls it once the settings say which folder is in use. A
// failure only leaves them for next time.
func (l *Library) ForgetOldRemovedDocuments() {
	l.forgetOldRemovedDocuments(time.Now())
}

func (l *Library) forgetOldRemovedDocuments(now time.Time) {
	removed, err := l.ListRemovedDocuments()
	if err != nil {
		return
	}

	for _, document := range removed {
		at, err := time.Parse(time.RFC3339, document.RemovedAt)
		if err == nil && now.Sub(at) > binKeepsFor {
			_ = l.ForgetRemovedDocument(document.ID)
		}
	}
}

// removedDir returns Recently removed, creating it if it is missing.
func (l *Library) removedDir() (string, error) {
	dir, err := l.libraryDir()
	if err != nil {
		return "", err
	}

	folder := filepath.Join(dir, RemovedFolder)
	if err := os.MkdirAll(folder, 0o755); err != nil {
		return "", fmt.Errorf("cannot create Recently removed %q: %w", folder, err)
	}

	return folder, nil
}

// removedAt reads when a document was removed. A missing or damaged record falls
// back to the given time, so the document still leaves Recently removed in the end.
func removedAt(path string, fallback time.Time) time.Time {
	contents, err := os.ReadFile(path)
	if err != nil {
		return fallback
	}

	at, err := time.Parse(time.RFC3339, strings.TrimSpace(string(contents)))
	if err != nil {
		return fallback
	}

	return at
}

// moveFile renames from to to, which keeps the file's time.
func moveFile(from string, to string) error {
	if err := os.Rename(from, to); err != nil {
		return fmt.Errorf("cannot move %q: %w", filepath.Base(from), err)
	}

	return nil
}

func moveIfThere(from string, to string) error {
	if _, err := os.Stat(from); errors.Is(err, fs.ErrNotExist) {
		return nil
	}

	return moveFile(from, to)
}

func removeIfThere(path string) error {
	if err := os.Remove(path); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return err
	}

	return nil
}
