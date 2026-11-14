package appconfig

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// Field picks one value out of a Config.
type Field func(Config) string

var (
	name        Field = func(c Config) string { return c.Name }
	id          Field = func(c Config) string { return c.ID }
	bundleID    Field = func(c Config) string { return c.BundleID }
	company     Field = func(c Config) string { return c.Company }
	description Field = func(c Config) string { return c.Description }
	copyright   Field = func(c Config) string { return c.Copyright }
	version     Field = func(c Config) string { return c.Version }
)

// Rule is one place outside app.config.json that has to hold a value from it.
// The pattern's one group is the value.
type Rule struct {
	File    string
	Pattern *regexp.Regexp
	Field   Field
	// What the value is, for messages.
	What string
}

func rule(file, pattern string, field Field, what string) Rule {
	return Rule{File: file, Pattern: regexp.MustCompile(pattern), Field: field, What: what}
}

// Rules are the files Wails and the systems read the app's identity from. They
// can't read app.config.json themselves, so `make rename` and `make version`
// write them, and Check says when one has drifted.
var Rules = []Rule{
	rule("go.mod", `(?m)^module (\S+)$`, id, "the Go module"),
	rule("main.go", `"([^"]+)/backend"`, id, "the backend import"),
	rule("Taskfile.yml", `APP_NAME: "([^"]*)"`, id, "the binary name"),

	rule("build/config.yml", `companyName: "([^"]*)"`, company, "the company"),
	rule("build/config.yml", `productName: "([^"]*)"`, name, "the product name"),
	rule("build/config.yml", `productIdentifier: "([^"]*)"`, bundleID, "the bundle id"),
	rule("build/config.yml", `\n  description: "([^"]*)"`, description, "the description"),
	rule("build/config.yml", `copyright: "([^"]*)"`, copyright, "the copyright"),
	rule("build/config.yml", `comments: "([^"]*)"`, description, "the comments"),
	rule("build/config.yml", `\n  version: "([^"]*)"`, version, "the version"),

	rule("build/windows/info.json", `"file_version": "([^"]*)"`, version, "the file version"),
	rule("build/windows/info.json", `"product_version": "([^"]*)"`, version, "the product version"),
	rule("build/windows/info.json", `"FileVersion": "([^"]*)"`, version, "the file version"),
	rule("build/windows/info.json", `"ProductVersion": "([^"]*)"`, version, "the product version"),
	rule("build/windows/info.json", `"CompanyName": "([^"]*)"`, company, "the company"),
	rule("build/windows/info.json", `"FileDescription": "([^"]*)"`, description, "the description"),
	rule("build/windows/info.json", `"LegalCopyright": "([^"]*)"`, copyright, "the copyright"),
	rule("build/windows/info.json", `"ProductName": "([^"]*)"`, name, "the product name"),
	rule("build/windows/info.json", `"Comments": "([^"]*)"`, description, "the comments"),

	rule("build/windows/wails.exe.manifest", `assemblyIdentity type="win32" name="([^"]*)" version="[^"]*"`, bundleID, "the bundle id"),
	rule("build/windows/wails.exe.manifest", `assemblyIdentity type="win32" name="[^"]*" version="([^"]*)"`, version, "the version"),

	rule("build/windows/nsis/wails_tools.nsh", `!define INFO_PROJECTNAME "([^"]*)"`, id, "the project name"),
	rule("build/windows/nsis/wails_tools.nsh", `!define INFO_COMPANYNAME "([^"]*)"`, company, "the company"),
	rule("build/windows/nsis/wails_tools.nsh", `!define INFO_PRODUCTNAME "([^"]*)"`, name, "the product name"),
	rule("build/windows/nsis/wails_tools.nsh", `!define INFO_PRODUCTVERSION "([^"]*)"`, version, "the version"),
	rule("build/windows/nsis/wails_tools.nsh", `!define INFO_COPYRIGHT "([^"]*)"`, copyright, "the copyright"),
}

func init() {
	for _, plist := range []string{"build/darwin/Info.plist", "build/darwin/Info.dev.plist"} {
		key := func(key string, field Field, what string) Rule {
			return rule(plist, `<key>`+key+`</key>\s*<string>([^<]*)</string>`, field, what)
		}

		Rules = append(Rules,
			key("CFBundleExecutable", id, "the executable"),
			key("CFBundleGetInfoString", description, "the description"),
			key("CFBundleIdentifier", bundleID, "the bundle id"),
			key("CFBundleName", name, "the bundle name"),
			key("CFBundleShortVersionString", version, "the version"),
			key("CFBundleVersion", version, "the version"),
			key("NSHumanReadableCopyright", copyright, "the copyright"),
		)
	}
}

// Check reads each rule's file under root and lists every value that differs from
// config. An empty list means the build agrees with app.config.json.
func Check(root string, config Config) ([]string, error) {
	var problems []string

	for _, r := range Rules {
		data, err := os.ReadFile(filepath.Join(root, r.File))
		if err != nil {
			return nil, err
		}

		matches := r.Pattern.FindAllSubmatch(data, -1)

		if len(matches) == 0 {
			problems = append(problems, fmt.Sprintf("%s: can't find %s", r.File, r.What))
			continue
		}

		for _, match := range matches {
			if got, want := string(match[1]), r.Field(config); got != want {
				problems = append(problems, fmt.Sprintf("%s: %s is %q, but app.config.json says %q", r.File, r.What, got, want))
			}
		}
	}

	return problems, nil
}

// Apply writes config's values into every rule's file under root.
func Apply(root string, config Config) error {
	byFile := map[string][]Rule{}
	var order []string

	for _, r := range Rules {
		if _, seen := byFile[r.File]; !seen {
			order = append(order, r.File)
		}

		byFile[r.File] = append(byFile[r.File], r)
	}

	for _, file := range order {
		path := filepath.Join(root, file)

		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}

		text := string(data)

		for _, r := range byFile[file] {
			text = replaceGroup(text, r.Pattern, r.Field(config))
		}

		if text != string(data) {
			if err := os.WriteFile(path, []byte(text), 0o644); err != nil {
				return err
			}
		}
	}

	return nil
}

// replaceGroup puts value in place of each match's first group, leaving the rest of the match.
func replaceGroup(text string, pattern *regexp.Regexp, value string) string {
	var out strings.Builder
	last := 0

	for _, at := range pattern.FindAllStringSubmatchIndex(text, -1) {
		out.WriteString(text[last:at[2]])
		out.WriteString(value)
		last = at[3]
	}

	out.WriteString(text[last:])

	return out.String()
}
