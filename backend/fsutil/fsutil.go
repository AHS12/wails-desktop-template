// Package fsutil holds the small file rules every part of the backend shares:
// writing a file so a crash can't leave half of it, the shape of an id that can
// name a file, and showing a folder or file in the system's file manager.
package fsutil

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"

	"wails-desktop-template/appconfig"
)

// WriteAtomic writes contents to path so that path never holds a partial file:
// the bytes go to a temporary file in the same folder, which is then renamed over
// the target. A failure along the way removes the temporary file, so no debris is
// left in the folder either.
func WriteAtomic(path string, contents []byte) error {
	dir := filepath.Dir(path)

	temp, err := os.CreateTemp(dir, "."+appconfig.Current().ID+"-*.tmp")
	if err != nil {
		return fmt.Errorf("cannot create a temporary file in %q: %w", dir, err)
	}

	tempName := temp.Name()
	discard := func(err error) error {
		temp.Close()
		os.Remove(tempName)

		return err
	}

	if _, err := temp.Write(contents); err != nil {
		return discard(fmt.Errorf("cannot write %q: %w", tempName, err))
	}

	if err := temp.Sync(); err != nil {
		return discard(fmt.Errorf("cannot flush %q to disk: %w", tempName, err))
	}

	if err := temp.Close(); err != nil {
		os.Remove(tempName)

		return fmt.Errorf("cannot close %q: %w", tempName, err)
	}

	// CreateTemp makes the file private; the app's files are ordinary ones.
	if err := os.Chmod(tempName, 0o644); err != nil {
		os.Remove(tempName)

		return fmt.Errorf("cannot set the permissions of %q: %w", tempName, err)
	}

	if err := os.Rename(tempName, path); err != nil {
		os.Remove(tempName)

		return fmt.Errorf("cannot replace %q: %w", path, err)
	}

	return nil
}

// ReadIfThere returns a file's bytes, or nil and no error when there is no file.
func ReadIfThere(path string) ([]byte, error) {
	contents, err := os.ReadFile(path)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}

	return contents, err
}

// idPattern is the only shape an id may have: a letter or digit followed by at
// most 63 letters, digits, dashes, or underscores. No separator of any kind is
// allowed, which is what keeps an id from naming anything outside its folder,
// including the ".." that would climb out of it.
var idPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`)

// ErrInvalidID reports an id that can't be turned into a file name.
var ErrInvalidID = errors.New("invalid id")

// CheckID rejects any id that is not a plain file stem. The message names the
// problem because a rejected id is always a caller bug, not something the user
// did with the file system.
func CheckID(id string) error {
	switch {
	case id == "":
		return fmt.Errorf("%w: it is empty", ErrInvalidID)
	case len(id) > 64:
		return fmt.Errorf("%w %q: it is longer than 64 characters", ErrInvalidID, id)
	case !idPattern.MatchString(id):
		return fmt.Errorf("%w %q: it must be 1 to 64 letters, digits, dashes, or underscores, and must start with a letter or digit", ErrInvalidID, id)
	default:
		return nil
	}
}

// CheckFileName refuses anything but a plain file name, so nothing reaches outside its folder.
func CheckFileName(name string) error {
	if name == "" || name == "." || name == ".." || name != filepath.Base(name) {
		return fmt.Errorf("%q is not a file name", name)
	}

	return nil
}

// ShowFolder opens a folder in the system's file manager.
func ShowFolder(dir string) error {
	name, arg := FileManagerCommand(dir)

	// Explorer reports failure through its exit code even when it opens the
	// window, so only a failure to start it means anything.
	return exec.Command(name, arg).Start()
}

// FileManagerCommand is what opens dir. The frontend joins folders with "/", and
// Explorer opens Documents instead of a path it can't read, so the path is cleaned
// into the system's own form first.
func FileManagerCommand(dir string) (string, string) {
	dir = filepath.Clean(dir)

	switch runtime.GOOS {
	case "windows":
		return "explorer", dir
	case "darwin":
		return "open", dir
	}

	return "xdg-open", dir
}

// Reveal opens the folder holding path with the file picked out. Where the
// system can't pick a file, the folder alone is opened.
func Reveal(path string) error {
	path = filepath.Clean(path)
	name, args := RevealCommand(path)
	command := exec.Command(name, args...)
	quoteForExplorer(command, path)

	return command.Start()
}

// RevealCommand is what shows path picked out in its folder.
func RevealCommand(path string) (string, []string) {
	path = filepath.Clean(path)

	switch runtime.GOOS {
	case "windows":
		return "explorer", []string{"/select," + path}
	case "darwin":
		return "open", []string{"-R", path}
	}

	return "xdg-open", []string{filepath.Dir(path)}
}
