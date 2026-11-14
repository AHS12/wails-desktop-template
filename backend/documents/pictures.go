package documents

// Pictures of saved documents are served to the interface as ordinary images,
// at /documents/<id>.png, so a page can load only the ones on screen instead of
// passing every picture across the bindings as a list of numbers.

import (
	"errors"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"wails-desktop-template/backend/fsutil"
)

// PicturePathPrefix is where the pictures are served from. The embedded
// interface has no folder of this name, so main.go sends these requests here.
const PicturePathPrefix = "/documents/"

// PictureHandler serves the pictures of saved documents, and of those in
// Recently removed under removed/. Anything else is not found, and the id goes
// through the same check as every other library path, so nothing outside the
// library can be read through it. It is a function rather than a method so
// Wails doesn't offer it to the interface.
func PictureHandler(library *Library) http.Handler {
	return http.StripPrefix(PicturePathPrefix, http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		name := request.URL.Path
		folder := library.libraryDir

		if rest, found := strings.CutPrefix(name, RemovedFolder+"/"); found {
			name, folder = rest, library.removedDir
		}

		ServePicture(writer, request, name, folder)
	}))
}

// ServePicture answers a request for the picture called name, as id.png, in
// the folder folder gives. Backups use it for a backup being restored.
func ServePicture(writer http.ResponseWriter, request *http.Request, name string, folder func() (string, error)) {
	if request.Method != http.MethodGet && request.Method != http.MethodHead {
		http.Error(writer, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	id, isPicture := strings.CutSuffix(name, PictureSuffix)
	if !isPicture || fsutil.CheckID(id) != nil {
		http.NotFound(writer, request)
		return
	}

	dir, err := folder()
	if err != nil {
		http.NotFound(writer, request)
		return
	}

	contents, err := os.ReadFile(filepath.Join(dir, id+PictureSuffix))
	if errors.Is(err, fs.ErrNotExist) {
		http.NotFound(writer, request)
		return
	}

	if err != nil {
		http.Error(writer, "cannot read the picture", http.StatusInternalServerError)
		return
	}

	// A picture changes whenever its document is saved; the address carries the
	// time saved, but the web view is told not to trust its copy either.
	writer.Header().Set("Content-Type", "image/png")
	writer.Header().Set("Cache-Control", "no-cache")
	_, _ = writer.Write(contents)
}
