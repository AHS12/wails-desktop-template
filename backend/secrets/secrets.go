// Package secrets keeps what must never be written in a settings file, such as
// a storage service's keys, in the system's own keychain: Windows Credential
// Manager, the macOS Keychain, or the Secret Service on Linux (GNOME Keyring or
// KWallet). Entries are named after the app's id, so two
// apps made from this template never share one.
//
// A secret goes in and can be read back by Go, but nothing here hands one to the
// interface. A feature decides what of it, if anything, is ever shown again.
package secrets

import (
	"errors"
	"fmt"
	"runtime"
	"sync"

	"wails-desktop-template/appconfig"

	"github.com/zalando/go-keyring"
)

// ErrNotFound reports a secret that was never saved, or was forgotten.
var ErrNotFound = errors.New("no such secret is saved")

// ErrNoKeychain reports a Linux desktop with no Secret Service running, as some
// minimal ones have. The words are what the person sees, so they say what to do.
var ErrNoKeychain = errors.New("this desktop has no keychain running. Install or unlock GNOME Keyring or KWallet, then try again")

// explain turns a keychain failure into one a person can act on. On Linux every
// failure but a missing entry means the Secret Service couldn't be reached.
func explain(err error, goos string) error {
	if goos == "linux" {
		return fmt.Errorf("%w (%v)", ErrNoKeychain, err)
	}

	return err
}

// Store keeps secrets by name.
type Store interface {
	Get(name string) (string, error)
	Set(name string, value string) error
	Delete(name string) error
}

// Keychain is the system's keychain, the store the running app uses.
type Keychain struct{}

func (Keychain) Get(name string) (string, error) {
	value, err := keyring.Get(appconfig.Current().ID, name)
	if errors.Is(err, keyring.ErrNotFound) {
		return "", ErrNotFound
	}

	if err != nil {
		return "", fmt.Errorf("cannot read %q from the keychain: %w", name, explain(err, runtime.GOOS))
	}

	return value, nil
}

func (Keychain) Set(name string, value string) error {
	if err := keyring.Set(appconfig.Current().ID, name, value); err != nil {
		return fmt.Errorf("cannot save %q in the keychain: %w", name, explain(err, runtime.GOOS))
	}

	return nil
}

// Delete forgets a secret. One that isn't there is already forgotten.
func (Keychain) Delete(name string) error {
	if err := keyring.Delete(appconfig.Current().ID, name); err != nil && !errors.Is(err, keyring.ErrNotFound) {
		return fmt.Errorf("cannot remove %q from the keychain: %w", name, explain(err, runtime.GOOS))
	}

	return nil
}

// Memory keeps secrets in memory, so tests never touch the person's keychain.
type Memory struct {
	mu     sync.Mutex
	values map[string]string
}

func (m *Memory) Get(name string) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	value, found := m.values[name]
	if !found {
		return "", ErrNotFound
	}

	return value, nil
}

func (m *Memory) Set(name string, value string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.values == nil {
		m.values = map[string]string{}
	}

	m.values[name] = value

	return nil
}

func (m *Memory) Delete(name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.values, name)

	return nil
}
