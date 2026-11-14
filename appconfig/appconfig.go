// Package appconfig is who the app is: its name, id, bundle id, repository and
// version, read from app.config.json beside this file. Everything else, in Go,
// the frontend and the build, takes these from here, so renaming the app is
// one file and `make rename`.
package appconfig

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"regexp"
)

//go:embed app.config.json
var embedded []byte

// Config is app.config.json.
type Config struct {
	// Name is what people see: the window title, the tray, messages.
	Name string `json:"name"`
	// ID names files and folders: the binary, the data folder, the keychain
	// entry, release files and the Go module. Lowercase letters, digits and dashes.
	ID string `json:"id"`
	// BundleID is the reverse-domain identifier the systems know the app by.
	BundleID    string `json:"bundleId"`
	Company     string `json:"company"`
	Description string `json:"description"`
	Copyright   string `json:"copyright"`
	// Repository is the GitHub owner/name that releases and issues come from.
	Repository string `json:"repository"`
	Version    string `json:"version"`
}

var (
	idPattern         = regexp.MustCompile(`^[a-z0-9][a-z0-9-]*$`)
	bundlePattern     = regexp.MustCompile(`^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$`)
	repositoryPattern = regexp.MustCompile(`^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$`)
	versionPattern    = regexp.MustCompile(`^\d+\.\d+\.\d+$`)
)

// Parse reads app.config.json and says what is wrong with it, if anything.
func Parse(data []byte) (Config, error) {
	var config Config

	if err := json.Unmarshal(data, &config); err != nil {
		return Config{}, fmt.Errorf("app.config.json is not valid JSON: %w", err)
	}

	return config, config.Validate()
}

// Validate checks each field has a shape every system accepts.
func (c Config) Validate() error {
	switch {
	case c.Name == "":
		return fmt.Errorf("app.config.json: name is empty")
	case !idPattern.MatchString(c.ID):
		return fmt.Errorf("app.config.json: id %q must be lowercase letters, digits and dashes", c.ID)
	case !bundlePattern.MatchString(c.BundleID):
		return fmt.Errorf("app.config.json: bundleId %q must look like com.example.app", c.BundleID)
	case !repositoryPattern.MatchString(c.Repository):
		return fmt.Errorf("app.config.json: repository %q must be owner/name", c.Repository)
	case !versionPattern.MatchString(c.Version):
		return fmt.Errorf("app.config.json: version %q must be like 1.2.3", c.Version)
	}

	return nil
}

var current = mustParse(embedded)

func mustParse(data []byte) Config {
	config, err := Parse(data)
	if err != nil {
		panic(err)
	}

	return config
}

// Current is the app this build is.
func Current() Config {
	return current
}
