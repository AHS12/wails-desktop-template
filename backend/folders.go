package backend

// Folders the interface picks or shows: choosing one, and opening one in the
// system's file manager.

import (
	"fmt"
	"os"

	"wails-desktop-template/backend/fsutil"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// ChooseFolder shows the native folder dialog, starting at start. Cancelling is
// not an error: it returns "", nil.
func (a *App) ChooseFolder(title string, start string) (string, error) {
	if err := a.checkDialogs(); err != nil {
		return "", err
	}

	return chosenPath(a.wails.Dialog.OpenFileWithOptions(&application.OpenFileDialogOptions{
		Title:                title,
		Directory:            start,
		CanChooseDirectories: true,
		CanCreateDirectories: true,
		Window:               a.window,
	}).PromptForSingleSelection())
}

// ShowFolder opens a folder, such as one an export or a backup wrote to, in the system's file manager. Only
// a folder that is there can be shown, so a path to a file or to nothing is an error.
func (a *App) ShowFolder(folder string) error {
	if err := checkPath(folder); err != nil {
		return err
	}

	info, err := os.Stat(folder)
	if err != nil || !info.IsDir() {
		return fmt.Errorf("%q is not a folder", folder)
	}

	return fsutil.ShowFolder(folder)
}
