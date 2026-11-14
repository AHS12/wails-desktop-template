package documents

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// savedAtTime writes a document with a picture and sets its time saved.
func savedAtTime(t *testing.T, app *Library, id string, at time.Time) {
	t.Helper()

	if err := app.WriteDocument(id, []byte(`{"name":"`+id+`"}`), []byte("png "+id)); err != nil {
		t.Fatal(err)
	}

	if err := os.Chtimes(filepath.Join(app.root, id+".json"), at, at); err != nil {
		t.Fatal(err)
	}
}

func TestRemovingADocumentMovesItAndItsPictureToTheBin(t *testing.T) {
	app := newLibrary(t)
	saved := time.Date(2026, time.March, 1, 9, 0, 0, 0, time.UTC)
	savedAtTime(t, app, "oak", saved)

	if err := app.RemoveDocument("oak"); err != nil {
		t.Fatal(err)
	}

	documents, err := app.ListDocuments()
	if err != nil || len(documents) != 0 {
		t.Fatalf("saved documents after removing = %v, %v", documents, err)
	}

	removed, err := app.ListRemovedDocuments()
	if err != nil {
		t.Fatal(err)
	}

	if len(removed) != 1 || removed[0].ID != "oak" || !removed[0].HasPicture {
		t.Fatalf("bin = %+v", removed)
	}

	if contents, err := app.ReadRemovedDocument("oak"); err != nil || string(contents) != `{"name":"oak"}` {
		t.Fatalf("document in Recently removed = %q, %v", contents, err)
	}

	if removed[0].SavedAt != saved.Format(time.RFC3339) {
		t.Fatalf("time saved in Recently removed = %s, want %s", removed[0].SavedAt, saved.Format(time.RFC3339))
	}
}

func TestPuttingBackRestoresTheSamePropAndPicture(t *testing.T) {
	app := newLibrary(t)
	saved := time.Date(2026, time.March, 1, 9, 0, 0, 0, time.UTC)
	savedAtTime(t, app, "oak", saved)

	if err := app.RemoveDocument("oak"); err != nil {
		t.Fatal(err)
	}

	if err := app.PutBackDocument("oak"); err != nil {
		t.Fatal(err)
	}

	contents, err := app.ReadDocument("oak")
	if err != nil || string(contents) != `{"name":"oak"}` {
		t.Fatalf("document = %q, %v", contents, err)
	}

	picture, err := app.ReadDocumentPicture("oak")
	if err != nil || string(picture) != "png oak" {
		t.Fatalf("picture = %q, %v", picture, err)
	}

	documents, err := app.ListDocuments()
	if err != nil || len(documents) != 1 || documents[0].SavedAt != saved.Format(time.RFC3339) {
		t.Fatalf("documents = %+v, %v", documents, err)
	}

	if entries := libraryEntries(t, filepath.Join(app.root, RemovedFolder)); len(entries) != 0 {
		t.Fatalf("bin still holds %v", entries)
	}
}

func TestPuttingBackNeverReplacesASavedProp(t *testing.T) {
	app := newLibrary(t)
	savedAtTime(t, app, "oak", time.Now())

	if err := app.RemoveDocument("oak"); err != nil {
		t.Fatal(err)
	}

	if err := app.WriteDocument("oak", []byte(`{"name":"new"}`), nil); err != nil {
		t.Fatal(err)
	}

	if err := app.PutBackDocument("oak"); !errors.Is(err, ErrAlreadyThere) {
		t.Fatalf("PutBackDocument = %v, want ErrAlreadyThere", err)
	}

	contents, _ := app.ReadDocument("oak")
	if string(contents) != `{"name":"new"}` {
		t.Fatalf("the saved document was replaced: %q", contents)
	}
}

func TestTheBinForgetsPropsAfterThirtyDaysAndNothingNewer(t *testing.T) {
	app := newLibrary(t)
	now := time.Date(2026, time.November, 4, 12, 0, 0, 0, time.UTC)

	savedAtTime(t, app, "old", now)
	savedAtTime(t, app, "recent", now)

	if err := app.removeDocument("old", now.Add(-31*24*time.Hour)); err != nil {
		t.Fatal(err)
	}

	if err := app.removeDocument("recent", now.Add(-29*24*time.Hour)); err != nil {
		t.Fatal(err)
	}

	app.forgetOldRemovedDocuments(now)

	removed, err := app.ListRemovedDocuments()
	if err != nil {
		t.Fatal(err)
	}

	if len(removed) != 1 || removed[0].ID != "recent" {
		t.Fatalf("bin = %+v, want only recent", removed)
	}

	if entries := libraryEntries(t, filepath.Join(app.root, RemovedFolder)); len(entries) != 3 {
		t.Fatalf("bin files = %v, want recent's three", entries)
	}
}

func TestForgettingARemovedPropRemovesAllOfIt(t *testing.T) {
	app := newLibrary(t)
	savedAtTime(t, app, "oak", time.Now())

	if err := app.RemoveDocument("oak"); err != nil {
		t.Fatal(err)
	}

	if err := app.ForgetRemovedDocument("oak"); err != nil {
		t.Fatal(err)
	}

	if entries := libraryEntries(t, filepath.Join(app.root, RemovedFolder)); len(entries) != 0 {
		t.Fatalf("bin still holds %v", entries)
	}
}

func TestTheBinRefusesIDsThatClimbOut(t *testing.T) {
	app := newLibrary(t)

	for _, id := range []string{"../oak", "removed/oak", "", ".."} {
		if err := app.RemoveDocument(id); err == nil {
			t.Fatalf("RemoveDocument(%q) succeeded", id)
		}

		if err := app.PutBackDocument(id); err == nil {
			t.Fatalf("PutBackDocument(%q) succeeded", id)
		}

		if err := app.ForgetRemovedDocument(id); err == nil {
			t.Fatalf("ForgetRemovedDocument(%q) succeeded", id)
		}
	}
}

func TestACopyGetsThePicture(t *testing.T) {
	app := newLibrary(t)
	savedAtTime(t, app, "oak", time.Now())

	if err := app.WriteDocument("oakcopy", []byte(`{}`), nil); err != nil {
		t.Fatal(err)
	}

	if err := app.CopyDocumentPicture("oak", "oakcopy"); err != nil {
		t.Fatal(err)
	}

	picture, err := app.ReadDocumentPicture("oakcopy")
	if err != nil || string(picture) != "png oak" {
		t.Fatalf("copy's picture = %q, %v", picture, err)
	}

	// A document without a picture is copied without one.
	if err := app.WriteDocument("bare", []byte(`{}`), nil); err != nil {
		t.Fatal(err)
	}

	if err := app.CopyDocumentPicture("bare", "barecopy"); err != nil {
		t.Fatalf("copying a missing picture = %v", err)
	}
}

func TestThePictureHandlerServesPicturesInTheBin(t *testing.T) {
	app := newLibrary(t)
	savedAtTime(t, app, "oak", time.Now())

	if err := app.RemoveDocument("oak"); err != nil {
		t.Fatal(err)
	}

	recorder := httptest.NewRecorder()
	PictureHandler(app).ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/documents/removed/oak.png", nil))

	if recorder.Code != http.StatusOK || recorder.Body.String() != "png oak" {
		t.Fatalf("status = %d, body = %q", recorder.Code, recorder.Body.String())
	}

	recorder = httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/", nil)
	request.URL.Path = "/documents/removed/../oak.json"
	PictureHandler(app).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", recorder.Code)
	}
}
