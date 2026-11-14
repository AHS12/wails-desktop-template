package documents

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"wails-desktop-template/backend/fsutil"
)

func TestListPropsSaysWhichPropsHaveAPicture(t *testing.T) {
	app := newLibrary(t)

	if err := app.WriteDocument("drawn", []byte(`{}`), []byte("png")); err != nil {
		t.Fatal(err)
	}

	if err := app.WriteDocument("plain", []byte(`{}`), nil); err != nil {
		t.Fatal(err)
	}

	documents, err := app.ListDocuments()
	if err != nil {
		t.Fatal(err)
	}

	got := map[string]bool{}
	for _, document := range documents {
		got[document.ID] = document.HasPicture
	}

	if !got["drawn"] || got["plain"] {
		t.Fatalf("HasPicture = %v, want drawn only", got)
	}
}

func TestWritingAPictureLeavesThePropsTimeAlone(t *testing.T) {
	app := newLibrary(t)

	if err := app.WriteDocument("oak", []byte(`{}`), nil); err != nil {
		t.Fatal(err)
	}

	path := filepath.Join(app.root, "oak.json")
	saved := time.Date(2025, time.March, 3, 9, 0, 0, 0, time.UTC)

	if err := os.Chtimes(path, saved, saved); err != nil {
		t.Fatal(err)
	}

	if err := app.WriteDocumentPicture("oak", []byte("png")); err != nil {
		t.Fatal(err)
	}

	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}

	if !info.ModTime().Equal(saved) {
		t.Fatalf("document time = %v, want %v", info.ModTime(), saved)
	}

	picture, err := app.ReadDocumentPicture("oak")
	if err != nil || string(picture) != "png" {
		t.Fatalf("picture = %q, %v", picture, err)
	}
}

func TestAnEmptyPictureIsRefused(t *testing.T) {
	app := newLibrary(t)

	if err := app.WriteDocumentPicture("oak", nil); err == nil {
		t.Fatal("an empty picture was written")
	}
}

func TestThePictureHandlerServesADocumentsPicture(t *testing.T) {
	app := newLibrary(t)

	if err := app.WriteDocument("oak", []byte(`{}`), []byte("png bytes")); err != nil {
		t.Fatal(err)
	}

	recorder := httptest.NewRecorder()
	PictureHandler(app).ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/documents/oak.png?v=2025", nil))

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", recorder.Code)
	}

	if recorder.Body.String() != "png bytes" || recorder.Header().Get("Content-Type") != "image/png" {
		t.Fatalf("body = %q, type = %q", recorder.Body.String(), recorder.Header().Get("Content-Type"))
	}
}

func TestThePictureHandlerServesNothingElse(t *testing.T) {
	app := newLibrary(t)

	if err := app.WriteDocument("oak", []byte(`{"secret":1}`), []byte("png")); err != nil {
		t.Fatal(err)
	}

	paths := []string{
		"/documents/oak.json",
		"/documents/missing.png",
		"/documents/../oak.png",
		"/documents/..%2Foak.png",
		"/documents/sub/oak.png",
		`/documents/sub\oak.png`,
		"/documents/.png",
		"/oak.png",
		"/index.html",
	}

	for _, path := range paths {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodGet, "/", nil)
		request.URL.Path = path

		PictureHandler(app).ServeHTTP(recorder, request)

		if recorder.Code != http.StatusNotFound {
			t.Fatalf("%s: status = %d, want 404", path, recorder.Code)
		}
	}
}

func TestPropsIndexRoundTrip(t *testing.T) {
	app := newLibrary(t)

	missing, err := app.ReadDocumentsIndex()
	if err != nil || missing != nil {
		t.Fatalf("a missing index should read as nil, nil, got %v, %v", missing, err)
	}

	if err := app.WriteDocumentsIndex([]byte(`{"version":1}`)); err != nil {
		t.Fatal(err)
	}

	read, err := app.ReadDocumentsIndex()
	if err != nil || string(read) != `{"version":1}` {
		t.Fatalf("got %q, %v", read, err)
	}
}

func TestShowingADocumentPicksOutItsFile(t *testing.T) {
	name, args := fsutil.RevealCommand(`K:\Games\documents/oak.json`)

	if len(args) == 0 {
		t.Fatalf("%s has no arguments", name)
	}

	switch name {
	case "explorer":
		if args[0] != "/select,"+filepath.Clean(`K:\Games\documents/oak.json`) {
			t.Fatalf("args = %v", args)
		}
	case "open":
		if args[0] != "-R" {
			t.Fatalf("args = %v", args)
		}
	}
}

func TestShowingAMissingPropIsAnError(t *testing.T) {
	app := newLibrary(t)

	if err := app.ShowDocument("missing"); err == nil {
		t.Fatal("showing a missing document succeeded")
	}
}
