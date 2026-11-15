package secrets

import (
	"errors"
	"testing"
)

func TestASecretComesBackAndThenIsForgotten(t *testing.T) {
	var store Store = &Memory{}

	if _, err := store.Get("keys"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("an unsaved secret read as %v", err)
	}

	if err := store.Set("keys", "very secret"); err != nil {
		t.Fatal(err)
	}

	if value, err := store.Get("keys"); err != nil || value != "very secret" {
		t.Fatalf("got %q, %v", value, err)
	}

	if err := store.Delete("keys"); err != nil {
		t.Fatal(err)
	}

	if _, err := store.Get("keys"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("a forgotten secret read as %v", err)
	}

	if err := store.Delete("keys"); err != nil {
		t.Fatalf("forgetting twice: %v", err)
	}
}

func TestALinuxKeychainFailureSaysWhatToInstall(t *testing.T) {
	cause := errors.New("The name org.freedesktop.secrets was not provided by any .service files")

	if err := explain(cause, "linux"); !errors.Is(err, ErrNoKeychain) {
		t.Errorf("on Linux, got %v", err)
	}

	if err := explain(cause, "windows"); err != cause {
		t.Errorf("elsewhere the system's own words should stay, got %v", err)
	}
}
