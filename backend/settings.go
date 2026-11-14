package backend

// Settings are the user's preferences: one JSON file beside the draft, so they
// survive a WebView reset. As with the draft, Go stores the bytes and hands them
// back; what they mean, and what a damaged file falls back to, is the frontend's
// business.

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"wails-desktop-template/backend/fsutil"
)

// settingsFileName names the settings file inside its folder.
const settingsFileName = "settings.json"

// errEmptySettings reports settings with nothing in them, which would replace
// real preferences with a file that says nothing.
var errEmptySettings = errors.New("refusing to write empty settings")

// WriteSettings stores contents as the settings, replacing any earlier ones. It
// goes through a temporary file, so a crash cannot leave half a file behind.
func (a *App) WriteSettings(contents []byte) error {
	if len(contents) == 0 {
		return errEmptySettings
	}

	path, err := a.settingsPath()
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("cannot create the settings folder %q: %w", filepath.Dir(path), err)
	}

	return fsutil.WriteAtomic(path, contents)
}

// ReadSettings returns the bytes of the settings. A missing file is not an
// error: it returns nil, nil, and the frontend starts from its defaults.
func (a *App) ReadSettings() ([]byte, error) {
	path, err := a.settingsPath()
	if err != nil {
		return nil, err
	}

	contents, err := os.ReadFile(path)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}

	return contents, err
}

// settingsPath returns the path of the settings file, in the data folder.
func (a *App) settingsPath() (string, error) {
	folder, err := a.dataFolder()
	if err != nil {
		return "", err
	}

	return filepath.Join(folder, settingsFileName), nil
}
