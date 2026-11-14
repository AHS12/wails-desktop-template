package backend

import (
	"fmt"
	"os"
	"path/filepath"

	"wails-desktop-template/appconfig"
)

// Shell is what a feature's service needs from the app: where the app keeps its
// own files, and a way to tell the interface something happened. Its fields are
// plain functions, so a feature's tests can pass their own without an app.
type Shell struct {
	// DataFolder is the app's own folder: settings, the draft, a feature's state.
	DataFolder func() (string, error)
	// Emit tells the interface an event happened. It does nothing before the app starts.
	Emit func(name string, data ...any)
}

// ShellOf is the shell a running app gives its features. It is a function rather
// than a method so Wails doesn't offer it to the interface.
func ShellOf(a *App) Shell {
	return Shell{DataFolder: a.dataFolder, Emit: a.emit}
}

// dataFolder is the app's own folder under the user config directory, named
// after the app's id. dataRoot overrides it in tests, so they never touch it.
func (a *App) dataFolder() (string, error) {
	if a.dataRoot != "" {
		return a.dataRoot, nil
	}

	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("cannot locate the user config directory: %w", err)
	}

	return filepath.Join(configDir, appconfig.Current().ID), nil
}
