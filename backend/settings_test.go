package backend

import (
	"testing"
)

func TestSettingsRoundTrip(t *testing.T) {
	app := &App{dataRoot: t.TempDir()}

	missing, err := app.ReadSettings()
	if err != nil || missing != nil {
		t.Fatalf("missing settings should read as nil, nil, got %v, %v", missing, err)
	}

	if err := app.WriteSettings([]byte(`{"version":1}`)); err != nil {
		t.Fatal(err)
	}

	read, err := app.ReadSettings()
	if err != nil || string(read) != `{"version":1}` {
		t.Fatalf("got %q, %v", read, err)
	}
}

func TestEmptySettingsAreRefused(t *testing.T) {
	app := &App{dataRoot: t.TempDir()}

	if err := app.WriteSettings(nil); err == nil {
		t.Fatal("expected empty settings to be refused")
	}
}
