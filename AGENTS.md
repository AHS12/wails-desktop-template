# wails-desktop-template

A starter for desktop apps: Wails 3 (Go) for the window, files, tray, backups and updates;
React and TypeScript for everything else. The example app keeps notes.

Read [CONTRIBUTING.md](CONTRIBUTING.md) first. Its rules apply to you, and this file only
adds what an agent needs on top of them.

## Commands

Run these from the repository root. On Windows, `make` uses Git Bash.

| Command | Does |
|---|---|
| `make check` | Every lint, test and build check. Run this before calling work done |
| `make lint` | TypeScript types, ESLint, golangci-lint |
| `make test-frontend` | Vitest, using Node 22 fetched by `pnpm dlx` |
| `make test-go` | Go tests |
| `make web` | The interface alone, in a browser |
| `make dev` | The desktop app with hot reload |
| `make version V=1.2.3` | Set the version everywhere |
| `make rename NAME=… ID=… BUNDLE=… REPO=…` | Rename the app everywhere |

To run one test file:

```bash
cd frontend && pnpm dlx node@22 node_modules/vitest/vitest.mjs run src/core/history/history.test.ts
```

The hooks run lint on commit and all tests on push. Don't skip them with `--no-verify`.
Commit or push only when asked. Work on `dev`, and don't touch `main`.

## How the code is arranged

- `appconfig/app.config.json` is who the app is. Go embeds it, the frontend imports it, and
  `tools/appinfo` keeps the build files in step. Never write the app's name or id anywhere
  else: use `appconfig.Current()` in Go and `APP` from `core/app.ts` in TypeScript.
- `backend/` is the core Wails service. Each other folder in it is a service of its own,
  registered in `main.go`. A service gets the data folder and a way to send events through
  `backend.Shell`, so its tests need no app.
- The frontend reaches Go only through `frontend/src/platform`. `platform/shell.ts` calls
  each Go method by name on one of the services in `SERVICES`, so there are no generated
  bindings. In tests, `fakeDesktop` stands in for every service at once.
- `frontend/src/core` is pure: ESLint rejects React, Zustand, the platform and features
  there.
- `frontend/src/features/*` are optional. Nothing outside `features/` may import one;
  each adds to the shell through the `Feature` contract in `shell/feature.ts`, and is
  listed in `features/index.ts`. [Removing a feature](docs/removing-features.md) has the
  steps, and they're tested.
- `frontend/src/example` is the Notes example: the note type, its editor, export formats
  and tours. `documentType` in `store/document-store.ts` picks the document type.
- The document store is the source of truth for the document in hand. Documents are
  immutable values: an unchanged document keeps the same object, so "unsaved" is an
  identity check.

## Rules that are easy to break

- **Document files:** if a document type's content changes shape, raise its `version`
  and add a migration from the old one. Files people have saved must keep opening.
- **Words on screen:** follow [docs/terminology.md](docs/terminology.md). Labels,
  tooltips and the changelog are written in plain language.
- **Sizes:** a postcss step in `vite.config.ts` turns stylesheet pixels into rems, and the
  interface scale sets the root font size. In code, use `rem` or `uiScale()`, never CSS zoom.
- **Styles:** each area has its own file in `src/styles`, and a feature or the example
  imports its own from its folder.
- **Long work:** use `afterPaint()` or `yieldIfBusy()` from `core/yield.ts`, so progress
  can draw before slow work blocks the page.
- **Licensing:** add no downloaded assets or copied code.

## Style

Match the code around you: four-space indent, no semicolons, single quotes, no spaces inside
import braces. Comments are few, and explain why rather than what. Test names read as plain
sentences about behavior. Tests sit beside the code they cover, or in `frontend/src/tests`.

## Reporting your work

Say what you ran and what you actually saw. A passing test doesn't show that a screen
looks right, so for visual work, look at it, and say so if you couldn't.

To drive the real desktop app from a script, start a development build with
`APP_DEBUG_PORT=9333`: WebView2 then listens for the Chrome DevTools protocol on that
port. Production builds never do.

## Skills

Task guides are in `.claude/skills/`. Read the matching one before starting:

- `try-in-browser`: run the interface and check a change by looking at it
- `release`: publish a new version
