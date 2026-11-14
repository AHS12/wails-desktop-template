# Contributing

Thanks for helping. Bug reports, ideas and code are all welcome.

## Reporting a bug or asking for something

[Open an issue](../../issues/new/choose) and pick a form. For a bug, the most useful things
are the version, what you were doing, and a screenshot. Please talk through a large change
in an issue before building it, so your time isn't spent on something that doesn't fit.

## Setting up

Follow [Build from source](README.md#build-from-source) in the README, then:

```bash
make install
make dev
```

`make install` also turns on the git hooks: lint before each commit and every test before
each push. `make web` runs only the interface in a browser, which is quicker for interface
work, but saving and native dialogs need the desktop app.

## Sending a pull request

1. Branch from `dev`, and open the pull request against `dev`. `main` only moves for releases.
2. Keep it to one change. A bug fix and a tidy-up are two pull requests.
3. Add a test for what you changed, where a test can show it.
4. Run `make check`.
5. For anything you can see, try it in the app and add a picture to the pull request.

Commit messages are a short sentence that starts with a verb and says what changed for the
person using the app, like `Ask before replacing files an export would overwrite`.

Don't edit `CHANGELOG.md`. It's written at release time, and the pull request template asks
for the line to use.

## What a change has to respect

**The template stays generic.** Code outside `frontend/src/example` doesn't know what a
note is. It talks about documents, and asks `documentType` for the word to show.

**Optional features stay removable.** Nothing outside `frontend/src/features` imports a
feature, and nothing outside a feature's Go package imports that package except
`main.go`. ESLint checks the frontend side. If you add a feature, add its steps to
[Removing a feature](docs/removing-features.md).

**Saved work keeps opening.** A document type that changes shape raises its `version` and
migrates older files. The settings file is versioned the same way.

**The name lives in one place.** Use `appconfig.Current()` in Go and `APP` in TypeScript;
`make check` fails if a build file disagrees with `appconfig/app.config.json`.

**Plain words on screen.** [docs/terminology.md](docs/terminology.md) applies to every word
the app shows.

**Everything scales.** Stylesheets can use pixels, because the build converts them. A size
set in code uses `rem` or `uiScale()`. Check your change at more than 100% interface scale.

**No code or art we can't license.** Don't add downloaded images, fonts or copied code,
including anything under the GPL or a paid license.

## Where things are

| Path | What it holds |
|---|---|
| `appconfig` | Who the app is: name, id, bundle id, repository, version |
| `backend` | Go: the core service, and a package per feature service |
| `frontend/src/core` | Pure code: the document file, undo, settings, search |
| `frontend/src/platform` | The only code that calls Go |
| `frontend/src/shell` | The menu bar, palette, settings, pages and the feature registry |
| `frontend/src/features` | Optional features |
| `frontend/src/example` | The Notes example |
| `tools/appinfo` | Renames the app, sets the version, checks the build files |

## License

By contributing, you agree that your work is released under the [MIT License](LICENSE.md).
