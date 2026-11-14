// Command appinfo keeps the app's identity in step with appconfig/app.config.json.
//
//	go run ./tools/appinfo check
//	go run ./tools/appinfo version 1.2.3
//	go run ./tools/appinfo rename -name "My App" -id my-app -bundle com.me.myapp -repo me/my-app
//
// Run it from the repository root. It's Go so that it runs the same on Windows and a Mac.
package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"go/format"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"

	"wails-desktop-template/appconfig"
)

const configPath = "appconfig/app.config.json"

func main() {
	if len(os.Args) < 2 {
		fail(errors.New("say what to do: check, version or rename"))
	}

	var err error

	switch os.Args[1] {
	case "check":
		err = check()
	case "version":
		err = setVersion(os.Args[2:])
	case "rename":
		err = rename(os.Args[2:])
	default:
		err = fmt.Errorf("%q isn't something appinfo does: use check, version or rename", os.Args[1])
	}

	if err != nil {
		fail(err)
	}
}

func fail(err error) {
	fmt.Fprintln(os.Stderr, "appinfo:", err)
	os.Exit(1)
}

func readConfig() (appconfig.Config, error) {
	data, err := os.ReadFile(configPath)
	if err != nil {
		return appconfig.Config{}, err
	}

	return appconfig.Parse(data)
}

func writeConfig(config appconfig.Config) error {
	if err := config.Validate(); err != nil {
		return err
	}

	var out bytes.Buffer
	encoder := json.NewEncoder(&out)
	encoder.SetEscapeHTML(false)
	encoder.SetIndent("", "  ")

	if err := encoder.Encode(config); err != nil {
		return err
	}

	return os.WriteFile(configPath, out.Bytes(), 0o644)
}

func check() error {
	config, err := readConfig()
	if err != nil {
		return err
	}

	problems, err := appconfig.Check(".", config)
	if err != nil {
		return err
	}

	if len(problems) > 0 {
		return fmt.Errorf("these don't match %s. Run `make version` or `make rename` to fix them:\n  %s", configPath, strings.Join(problems, "\n  "))
	}

	fmt.Printf("%s %s: every build file agrees.\n", config.Name, config.Version)

	return nil
}

func setVersion(args []string) error {
	if len(args) != 1 {
		return errors.New("give the version, as in: appinfo version 1.2.3")
	}

	config, err := readConfig()
	if err != nil {
		return err
	}

	config.Version = strings.TrimPrefix(args[0], "v")

	if err := writeConfig(config); err != nil {
		return err
	}

	if err := appconfig.Apply(".", config); err != nil {
		return err
	}

	fmt.Printf("Set the version to %s. Add it to the top of CHANGELOG.md too.\n", config.Version)

	return nil
}

func rename(args []string) error {
	old, err := readConfig()
	if err != nil {
		return err
	}

	next := old
	flags := flag.NewFlagSet("rename", flag.ContinueOnError)
	flags.StringVar(&next.Name, "name", old.Name, "what people see, such as \"My App\"")
	flags.StringVar(&next.ID, "id", old.ID, "for files and folders, such as my-app")
	flags.StringVar(&next.BundleID, "bundle", old.BundleID, "such as com.me.myapp")
	flags.StringVar(&next.Repository, "repo", old.Repository, "the GitHub owner/name, such as me/my-app")
	flags.StringVar(&next.Company, "company", old.Company, "who makes it")
	flags.StringVar(&next.Description, "description", old.Description, "one sentence about it")
	flags.StringVar(&next.Copyright, "copyright", old.Copyright, "such as © 2026 Me")

	if err := flags.Parse(args); err != nil {
		return err
	}

	if err := next.Validate(); err != nil {
		return err
	}

	// Longest first, so the bundle id and repository go whole before the id inside them.
	pairs := [][2]string{{old.BundleID, next.BundleID}, {old.Repository, next.Repository}, {old.ID, next.ID}}
	sort.SliceStable(pairs, func(i, j int) bool { return len(pairs[i][0]) > len(pairs[j][0]) })

	files, err := trackedTextFiles()
	if err != nil {
		return err
	}

	changed := 0

	for _, file := range files {
		if filepath.ToSlash(file) == configPath {
			continue
		}

		data, err := os.ReadFile(file)
		if err != nil {
			return err
		}

		text := string(data)

		for _, pair := range pairs {
			if pair[0] != pair[1] {
				text = strings.ReplaceAll(text, pair[0], pair[1])
			}
		}

		if text != string(data) {
			// A new module name can sort its imports differently.
			if strings.HasSuffix(file, ".go") {
				formatted, err := format.Source([]byte(text))
				if err != nil {
					return fmt.Errorf("%s: %w", file, err)
				}

				text = string(formatted)
			}

			if err := os.WriteFile(file, []byte(text), 0o644); err != nil {
				return err
			}

			changed++
		}
	}

	if err := writeConfig(next); err != nil {
		return err
	}

	if err := appconfig.Apply(".", next); err != nil {
		return err
	}

	fmt.Printf("Renamed %s to %s in %d files.\n", old.Name, next.Name, changed)

	return leftovers(files, old, next)
}

// leftovers says where the old id is still written, which only a person can sort out.
func leftovers(files []string, old, next appconfig.Config) error {
	if old.ID == next.ID {
		return nil
	}

	var found []string

	for _, file := range files {
		data, err := os.ReadFile(file)
		if err == nil && bytes.Contains(data, []byte(old.ID)) {
			found = append(found, file)
		}
	}

	if len(found) > 0 {
		return fmt.Errorf("%q is still in:\n  %s", old.ID, strings.Join(found, "\n  "))
	}

	return nil
}

// trackedTextFiles lists what git tracks, leaving out pictures and other binary files.
func trackedTextFiles() ([]string, error) {
	output, err := exec.Command("git", "ls-files", "-z").Output()
	if err != nil {
		return nil, fmt.Errorf("git ls-files: %w", err)
	}

	var files []string

	for _, file := range strings.Split(strings.TrimRight(string(output), "\x00"), "\x00") {
		data, err := os.ReadFile(file)
		if err != nil || bytes.IndexByte(data, 0) >= 0 {
			continue
		}

		files = append(files, file)
	}

	return files, nil
}
