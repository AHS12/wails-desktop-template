package backend

import (
	"bytes"
	"context"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"slices"
	"strings"
	"sync"
	"testing"
)

// newDraftApp returns an App whose draft folder is a fresh temporary folder, so
// no test ever touches the user's real config directory.
func newDraftApp(t *testing.T) *App {
	t.Helper()

	app := NewApp()
	app.dataRoot = t.TempDir()

	return app
}

func TestWriteThenReadDraftRoundTripsExactBytes(t *testing.T) {
	app := newDraftApp(t)

	tests := []struct {
		name     string
		contents []byte
	}{
		{name: "json text", contents: []byte(`{"version":1,"scene":{"components":[]}}`)},
		{name: "binary", contents: []byte{0x00, 0x01, 0x7f, 0x80, 0xfe, 0xff, 0x0a, 0x0d}},
		{name: "single nul byte", contents: []byte{0x00}},
		{name: "utf-8 text", contents: []byte("Baum — árbol — 木\n")},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if err := app.WriteDraft(test.contents); err != nil {
				t.Fatalf("WriteDraft: %v", err)
			}

			got, err := app.ReadDraft()
			if err != nil {
				t.Fatalf("ReadDraft: %v", err)
			}

			if !bytes.Equal(got, test.contents) {
				t.Fatalf("ReadDraft = %v, want %v", got, test.contents)
			}
		})
	}
}

func TestReadDraftWithoutADraftReturnsNothing(t *testing.T) {
	app := newDraftApp(t)

	got, err := app.ReadDraft()
	if err != nil {
		t.Fatalf("ReadDraft with no draft: %v, want no error", err)
	}

	if got != nil {
		t.Fatalf("ReadDraft with no draft = %v, want nil", got)
	}
}

func TestClearDraftRemovesTheDraft(t *testing.T) {
	app := newDraftApp(t)

	if err := app.WriteDraft([]byte(`{"draft":1}`)); err != nil {
		t.Fatalf("WriteDraft: %v", err)
	}

	if err := app.ClearDraft(); err != nil {
		t.Fatalf("ClearDraft: %v", err)
	}

	got, err := app.ReadDraft()
	if err != nil {
		t.Fatalf("ReadDraft after ClearDraft: %v, want no error", err)
	}

	if got != nil {
		t.Fatalf("ReadDraft after ClearDraft = %v, want nil", got)
	}

	if entries := folderEntries(t, app.dataRoot); len(entries) != 0 {
		t.Fatalf("the draft folder still holds %v after ClearDraft", entries)
	}
}

func TestClearDraftTwiceIsFine(t *testing.T) {
	app := newDraftApp(t)

	// Clearing without ever having written is the same as clearing twice.
	if err := app.ClearDraft(); err != nil {
		t.Fatalf("ClearDraft with no draft: %v", err)
	}

	if err := app.WriteDraft([]byte(`{"draft":1}`)); err != nil {
		t.Fatalf("WriteDraft: %v", err)
	}

	if err := app.ClearDraft(); err != nil {
		t.Fatalf("first ClearDraft: %v", err)
	}

	if err := app.ClearDraft(); err != nil {
		t.Fatalf("second ClearDraft: %v", err)
	}
}

func TestWriteDraftRefusesEmptyContents(t *testing.T) {
	app := newDraftApp(t)

	tests := []struct {
		name     string
		contents []byte
	}{
		{name: "nil", contents: nil},
		{name: "empty", contents: []byte{}},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := app.WriteDraft(test.contents)
			if err == nil {
				t.Fatal("WriteDraft of empty contents succeeded, want an error")
			}

			if !errors.Is(err, errEmptyDraft) {
				t.Fatalf("WriteDraft error = %v, want %v", err, errEmptyDraft)
			}

			// The message names the problem, because it reaches a person.
			if !strings.Contains(strings.ToLower(err.Error()), "empty draft") {
				t.Fatalf("WriteDraft error = %q, want it to say the draft is empty", err)
			}

			if entries := folderEntries(t, app.dataRoot); len(entries) != 0 {
				t.Fatalf("the draft folder holds %v after a refused write", entries)
			}
		})
	}
}

func TestTheDraftLivesInTheDataFolder(t *testing.T) {
	app := newDraftApp(t)

	path, err := app.draftPath()
	if err != nil {
		t.Fatal(err)
	}

	// The library is a folder of its own inside the data folder, so the draft,
	// beside it, is never listed as a saved document.
	if path != filepath.Join(app.dataRoot, draftFileName) {
		t.Fatalf("draft = %q, want it straight inside %q", path, app.dataRoot)
	}
}

func TestWriteDraftReplacesExistingDraftAndLeavesNoTempFiles(t *testing.T) {
	app := newDraftApp(t)

	if err := app.WriteDraft([]byte("first")); err != nil {
		t.Fatalf("first WriteDraft: %v", err)
	}

	if err := app.WriteDraft([]byte("second")); err != nil {
		t.Fatalf("second WriteDraft: %v", err)
	}

	got, err := app.ReadDraft()
	if err != nil {
		t.Fatalf("ReadDraft: %v", err)
	}

	if string(got) != "second" {
		t.Fatalf("ReadDraft = %q, want %q", got, "second")
	}

	// The rename left exactly one file behind, no temporary ones.
	want := []string{"draft.json"}
	if got := folderEntries(t, app.dataRoot); !reflect.DeepEqual(got, want) {
		t.Fatalf("the draft folder holds %v, want %v", got, want)
	}
}

// recordingRuntime replaces the two window operations the close guard drives
// with ones that record what it asked for, so the tests need no window.
type recordingRuntime struct {
	events []string
	quits  int
}

func (r *recordingRuntime) emit(eventName string) {
	r.events = append(r.events, eventName)
}

func (r *recordingRuntime) close() {
	r.quits++
}

// newCloseGuardApp returns an App that has started, as if the frontend were
// listening, together with the recording that stands in for its window.
func newCloseGuardApp(t *testing.T) (*App, *recordingRuntime) {
	t.Helper()

	app := NewApp()
	startApp(t, app)

	recorded := &recordingRuntime{}
	app.closeRuntime = recorded

	return app, recorded
}

func TestBeforeCloseDoesNotPreventWhenNothingIsUnsaved(t *testing.T) {
	app, recorded := newCloseGuardApp(t)

	if got := app.beforeClose(); got {
		t.Fatal("BeforeClose with nothing unsaved = true, want false so the close goes through")
	}

	app.SetUnsaved(true)
	app.SetUnsaved(false)

	if got := app.beforeClose(); got {
		t.Fatal("BeforeClose after SetUnsaved(false) = true, want false so the close goes through")
	}

	if len(recorded.events) != 0 {
		t.Fatalf("the guard asked the interface %v with nothing unsaved, want no request", recorded.events)
	}

	if recorded.quits != 0 {
		t.Fatalf("the guard closed the window %d times with nothing unsaved, want none", recorded.quits)
	}
}

func TestBeforeClosePreventsAndAsksWhenSomethingIsUnsaved(t *testing.T) {
	app, recorded := newCloseGuardApp(t)
	app.SetUnsaved(true)

	// The close is prevented so the interface can ask in its own dialog.
	if got := app.beforeClose(); !got {
		t.Fatal("BeforeClose with unsaved changes = false, want true to prevent while the interface asks")
	}

	// The name is pinned: the frontend listens for exactly this one.
	want := []string{"app:close-requested"}
	if !reflect.DeepEqual(recorded.events, want) {
		t.Fatalf("the guard asked the interface with %v, want %v", recorded.events, want)
	}

	if recorded.quits != 0 {
		t.Fatalf("the guard closed the window %d times before the user agreed, want none", recorded.quits)
	}

	// Nothing has been decided yet, so a second attempt asks again.
	if got := app.beforeClose(); !got {
		t.Fatalf("second BeforeClose with unsaved changes = false, want true to prevent again")
	}

	// Exactly one request per attempt, and still no quit.
	if len(recorded.events) != 2 {
		t.Fatalf("the guard asked the interface %v, want two requests", recorded.events)
	}

	if recorded.quits != 0 {
		t.Fatalf("the guard closed the window %d times, want none", recorded.quits)
	}
}

func TestBeforeCloseDoesNotPreventWithoutAStartupContext(t *testing.T) {
	app := NewApp()
	recorded := &recordingRuntime{}
	app.closeRuntime = recorded
	app.SetUnsaved(true)

	// Startup never ran, so there is no frontend to ask. The close goes through,
	// unprevented: an app nobody can leave is a worse bug than an unsaved change.
	if got := app.beforeClose(); got {
		t.Fatal("BeforeClose with unsaved changes and no startup context = true, want false so the close goes through")
	}

	if len(recorded.events) != 0 {
		t.Fatalf("the guard asked the interface %v without a startup context, want no request", recorded.events)
	}

	if recorded.quits != 0 {
		t.Fatalf("the guard closed the window %d times without a startup context, want none", recorded.quits)
	}
}

func TestConfirmCloseLetsTheNextCloseThrough(t *testing.T) {
	app, recorded := newCloseGuardApp(t)
	app.SetUnsaved(true)

	if got := app.beforeClose(); !got {
		t.Fatal("BeforeClose with unsaved changes = false, want true to prevent while the interface asks")
	}

	app.ConfirmClose()

	if recorded.quits != 1 {
		t.Fatalf("ConfirmClose closed the window %d times, want once", recorded.quits)
	}

	// The user agreed, so the close that follows is not prevented.
	if got := app.beforeClose(); got {
		t.Fatal("BeforeClose after ConfirmClose = true, want false so the close goes through unasked")
	}

	if len(recorded.events) != 1 {
		t.Fatalf("the guard asked the interface %v, want only the first request", recorded.events)
	}
}

func TestConfirmCloseWithoutAStartupContextDoesNothing(t *testing.T) {
	app := NewApp()
	recorded := &recordingRuntime{}
	app.closeRuntime = recorded

	// Startup never ran, so there is no window to close; this must not panic.
	app.ConfirmClose()

	if recorded.quits != 0 {
		t.Fatalf("ConfirmClose closed the window %d times without a startup context, want none", recorded.quits)
	}

	// The agreement is remembered all the same.
	app.SetUnsaved(true)

	if got := app.beforeClose(); got {
		t.Fatal("BeforeClose after ConfirmClose = true, want false so the close goes through")
	}
}

func TestSetUnsavedIsSafeForConcurrentCallers(t *testing.T) {
	app := NewApp()

	const (
		workers    = 8
		iterations = 100
	)

	var wait sync.WaitGroup
	for worker := 0; worker < workers; worker++ {
		wait.Add(1)

		go func(worker int) {
			defer wait.Done()

			for iteration := 0; iteration < iterations; iteration++ {
				app.SetUnsaved((worker+iteration)%2 == 0)
				_ = app.hasUnsavedChanges()
			}
		}(worker)
	}

	wait.Wait()

	app.SetUnsaved(true)
	if !app.hasUnsavedChanges() {
		t.Fatal("SetUnsaved(true) did not stick")
	}

	app.SetUnsaved(false)
	if app.hasUnsavedChanges() {
		t.Fatal("SetUnsaved(false) did not stick")
	}
}

// folderEntries lists the names in dir, sorted, so a test can say exactly what
// the folder holds, including that nothing else is left behind.
func folderEntries(t *testing.T, dir string) []string {
	t.Helper()

	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("reading %q: %v", dir, err)
	}

	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		names = append(names, entry.Name())
	}

	slices.Sort(names)

	return names
}

func TestABusyFeatureHoldsTheCloseForTheInterface(t *testing.T) {
	recorder := &recordingRuntime{}
	app := &App{ctx: context.Background(), closeRuntime: recorder}

	app.SetBusy("backup")

	if !app.beforeClose() {
		t.Fatal("a close while a backup was due went straight through")
	}

	if len(recorder.events) != 1 || recorder.events[0] != CloseRequestedEvent {
		t.Fatalf("events = %v, want the close question", recorder.events)
	}

	app.SetBusy("")

	if app.beforeClose() {
		t.Fatal("a close with nothing due was held")
	}
}
