package backend

// The draft is the one document the session has not saved yet: the bytes the
// close guard promises to keep. It lives in the data folder, never inside the
// library, because the library lists every *.json in its folder and a draft
// must never be offered back as a saved document.
//
// As everywhere else in this package, the contents are opaque. Go stores the
// bytes and hands them back; what they describe is the frontend's business.

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"wails-desktop-template/backend/fsutil"
)

// draftFileName names the file holding the draft inside its folder.
const draftFileName = "draft.json"

// errEmptyDraft reports a draft with nothing in it. An empty draft is worse
// than none: the next launch would offer to restore work that says nothing.
var errEmptyDraft = errors.New("refusing to write an empty draft, because an empty draft is worse than none")

// WriteDraft stores contents as the unsaved draft, replacing any earlier one.
// It is written to a temporary file and renamed into place, so a crash
// mid-write cannot leave a half draft to be offered back.
//
// The bytes are written as given: Go does not know or care what they describe.
// Empty contents are refused, and nothing is written.
func (a *App) WriteDraft(contents []byte) error {
	if len(contents) == 0 {
		return errEmptyDraft
	}

	path, err := a.draftPath()
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("cannot create the draft folder %q: %w", filepath.Dir(path), err)
	}

	return fsutil.WriteAtomic(path, contents)
}

// ReadDraft returns the bytes of the draft. A missing draft is not an error: it
// returns nil, nil, so the frontend can offer nothing and start with an empty
// document. Any other read error is passed through unchanged.
func (a *App) ReadDraft() ([]byte, error) {
	path, err := a.draftPath()
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

// ClearDraft removes the draft. Removing a draft that is already gone is not an
// error: a save, a discard, and a failed write can all clear it, and the last
// one to arrive must not be told it did something wrong.
func (a *App) ClearDraft() error {
	path, err := a.draftPath()
	if err != nil {
		return err
	}

	if err := os.Remove(path); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return fmt.Errorf("cannot remove the draft %q: %w", path, err)
	}

	return nil
}

// draftPath returns the path of the draft file, in the data folder. Nothing is
// created here: callers decide whether their operation needs the folder.
func (a *App) draftPath() (string, error) {
	folder, err := a.dataFolder()
	if err != nil {
		return "", err
	}

	return filepath.Join(folder, draftFileName), nil
}
