# wails-desktop-template — plan

A Wails 3 starter for desktop apps that feel like desktop apps. It's made from the shell of
[easy-props](https://github.com/AHS12/easy-props) 0.4.7, with everything about 3D props taken
out. It replaces [go-fyne-desktop-template](https://github.com/AHS12/go-fyne-desktop-template).

The template keeps the parts every app needs sooner or later, already working: export,
show in file manager, backup, a bin, autosave, undo, the updater, the tray and settings. When
a new app doesn't need one, deleting it should take minutes. Adding it later would take weeks.

---

## 1. Principles

1. **Built in, easy to remove.** Each optional feature (backup, cloud backup, bin, tour, report
   a problem, export) lives in its own folder on both sides, Go and frontend. Its commands,
   settings page and menu entries are registered from that folder, so removing it means
   deleting the folder and one line in a registry. `docs/removing-features.md` lists the steps.
2. **"Documents", not "props".** The easy-props library becomes a generic folder of
   documents: one JSON file each, with an optional picture beside it. Every prop or tree word
   is renamed. The example app has one document type, "Note".
3. **Go stays narrow, as it does now.** Go handles files, dialogs, the window, the tray,
   updates and secrets. Documents are bytes to Go. Every app decision is made in TypeScript.
4. **The app's name lives in one place.** A rename script rewrites it everywhere, and a test
   fails if the old name is left anywhere.
5. **Tests come along.** Every piece we keep brings its Go and Vitest tests, renamed with it.
   `make check` must pass at every phase.
6. **Fresh history.** This is a new repository. Code is copied over, not forked, and no
   easy-props commits come with it. It stays MIT.

---

## 2. Inventory: what comes from easy-props

Legend: **Keep** means copy it and rename it. **Generalise** means it's useful, but it's
written around props and needs reshaping. **Example** means it stays only as a small,
working sample of the pattern. **Drop** means it isn't copied.

### 2.1 Go backend (`backend/`)

| Piece | Source | Plan | Notes |
|---|---|---|---|
| App service, lifecycle, `emit` | `app.go` | Keep | Error prefix comes from one `appName` constant, not `"easy-props:"` |
| Close guard (unsaved work, ask before quit, `QuitGuard`, `ConfirmClose`) | `app.go` | Keep | Mac Cmd+Q, tray Quit and the close button all go through it |
| "Something is pending" on close (`SetBackupDue`) | `app.go` | Generalise | Becomes `SetBusy(reason)` so any feature can hold the close for a moment |
| Native open and save dialogs with filters | `app.go` | Keep | |
| Read and write any file the user picked | `app.go` | Keep | |
| Atomic writes (temp file, then rename) | `library.go` `writeFileAtomic` | Keep | Moves to `backend/fsutil` and is used by every writer |
| Window: remembered size and place, kept on screen when monitors change, fit to the desktop | `window.go` | Keep | Some of the best code here. Its tests come too |
| Frameless window on Windows, inset title bar on Mac | `main.go` | Keep | |
| Single instance, second launch brings the window forward | `main.go`, `tray.go` `SecondLaunch` | Keep | The instance ID comes from the product identifier |
| Tray: close to tray, minimise to tray, Show and Quit menu, Mac template icon | `tray.go` | Keep | |
| Settings file (JSON, refuses empty writes) | `settings.go` | Keep | |
| Show in file manager / reveal a file (Explorer `/select,` quoting, `open -R`, xdg) | `settings.go`, `reveal_*.go` | Keep | Moves to `backend/shell/reveal*.go` |
| System name for bug reports (Windows 10 vs 11 build check) | `system*.go` | Keep | |
| Self-updater, Windows: GitHub latest release, version compare, verified download with progress, silent NSIS run on close, rate-limit message | `update.go`, `update_windows.go` | Keep | Owner and repo come from config. Asset names come from one function |
| Self-updater, Mac: Wails updater, zip from the release, checksum check, "move to Applications" and "read-only" reasons | `update_mac.go` | Keep | |
| Export: choose a folder, write many files, refuse names that leave the folder, list files already there, show the folder | `export.go` | Keep | Generic already. Moves to `backend/export` |
| Draft autosave (one unsaved document, crash-safe) | `draft.go` | Keep | |
| Document library: list, read, write with picture, delete, reveal, ids that can't leave the folder, folder can be moved | `library.go`, `settings.go` | Generalise | Props become documents. The trees-folder migration is dropped |
| Pictures served from disk over the asset server (`/your-props/` middleware) | `pictures.go`, `main.go` | Generalise | Becomes `/documents/<id>.png`. A good pattern for any thumbnails |
| Bin: move to bin, put back, forget, empty anything older than 30 days | `bin.go` | Generalise | Becomes "Recently removed" for documents |
| Backup to a zip: manifest, progress events, stop, newer-version refusal | `backup.go` | Generalise | Holds the documents folder plus whatever extra bytes the frontend hands over (it was palettes) |
| Restore in two steps: unpack to a holding folder, preview, then restore only what's chosen | `backup.go` | Generalise | |
| Automatic folder backups: fingerprint, folder still there, keep the last N | `folder_backup.go` | Generalise | |
| Cloud backup over S3 (AWS, R2, B2, Wasabi, Spaces, MinIO): uploads only what changed, never deletes, manifest can be rebuilt | `cloud.go`, `cloud_backup.go` | Generalise | An optional feature, and the heaviest one (AWS SDK). See decision D3 |
| Secrets in the system keychain (Credential Manager or Keychain) | `keychain.go` | Generalise | Becomes `SetSecret(name)`, `HasSecret`, `ForgetSecret`. Cloud keys are one user of it |
| Props index file | `settings.go` | Generalise | Becomes `documents-index.json`, a cache of document summaries |

### 2.2 Frontend platform layer (`frontend/src/platform/`)

| Piece | Source | Plan |
|---|---|---|
| Shell connection, call Go by name, `fakeDesktop` for tests | `shell.ts` | Keep. This is the heart of how the browser and desktop builds both work |
| Bytes from bindings (base64 and arrays), PNG data URL | `bytes.ts` | Keep |
| Clipboard with a fallback | `clipboard.ts` | Keep |
| Close guard events | `close-guard.ts` | Keep |
| Window: minimise, maximise, close, Mac check, open link, quit, tray switches | `window.ts` | Keep |
| Open and save a document file, save a picture, choose a folder, export files, show folder, falls back to browser download in `make web` | `desktop.ts` | Keep. The name "project" becomes "document" |
| Draft read, write and clear, plus `setUnsaved` | `draft.ts` | Keep |
| Settings file, with a localStorage copy for the browser | `settings.ts` | Keep. The library info moves to `documents.ts` |
| Updates and progress events | `update.ts` | Keep |
| System name | `system.ts` | Keep |
| Library and bin | `library.ts` | Generalise into `documents.ts` |
| Backup and cloud | `backup.ts` | Generalise. Optional feature |

### 2.3 Frontend core (`frontend/src/core/`)

| Piece | Source | Plan |
|---|---|---|
| Settings spec: typed toggle, choice, number and colour settings, pages, keywords, help, defaults, versioned file, panel layout | `settings/settings-spec.ts` | Generalise. Keeps the machinery and the shell settings (start on, autosave, confirm, what's new, updates, close and minimise buttons, theme, scale, reduce motion, help on hover). Drops camera, viewport, performance and export settings |
| Theme: system, light or dark, follows the OS | `settings/theme.ts` | Keep |
| px→rem postcss step and interface scale | `settings/px-to-rem.ts`, `vite.config.ts` | Keep |
| Command registry: id, label, shortcut, when enabled, why disabled, run | `commands/commands.ts` | Generalise. Keeps the engine (`runCommand`, `findCommand`, `shortcutOf`, `commandForKeys`, rebindable keys). Commands register per feature instead of in one list of 937 lines |
| Fuzzy search and sections for the palette, `>` style prefixes | `commands/palette-search.ts` | Keep. Sections become Actions, Settings and Documents |
| Undo and redo history with labels | `history/history.ts` | Keep. Generic already |
| Versioned document file: schema version, generator, friendly `FileError`, unknown keys kept | `project/project-document.ts` | Example. Its shape becomes the Note document |
| Document summaries, sort, "Today / This week / Earlier" groups, search | `library/prop-summary.ts` | Generalise |
| Index cache that is refreshed against file times | `library/props-index.ts` | Generalise |
| Restore plan: new, same, different, removed, "(from backup)" names | `library/restore-plan.ts` | Generalise |
| Automatic backup timing: due, fingerprint, failing too long | `backup/auto.ts` | Generalise. Optional |
| Cloud services list and endpoint tidying | `backup/cloud-services.ts` | Keep. Optional |
| Changelog parser and "what's new is due" | `changelog.ts` | Keep. Reads the repository's `CHANGELOG.md` at build time |
| Report a problem: GitHub issue link with the length limit, copied rest, forms that match the issue templates, system list | `feedback/*.ts` | Generalise. Repository URL from config. Drop the prop form and `propLine`. The context hook is filled by the app |
| `afterPaint` / `yieldIfBusy` for long work | `export/pipeline/yield.ts` | Keep. Moves to `core/yield.ts` |
| Colour code parsing (hex, rgb and lists) | `colour-code.ts` | Keep. Small, and the colour picker needs it |
| Picture helpers: data URL to bytes, `folderOf`, safe file names | `export/picture.ts` | Generalise into `core/files.ts` |
| Saved export preferences (folder, last choices) | `export/export-preferences.ts` | Generalise. The prop-specific parts are dropped. `APP_VERSION` moves to `core/version.ts` |
| Selection state | `selection/selection.ts` | Drop. Too specific to the 3D scene |
| Scene, assets, export pipeline, wind, collision, far cards, Godot and Unreal | `scene/`, `assets/`, `export/` | Drop |

### 2.4 Stores (`frontend/src/store/`)

| Store | Plan |
|---|---|
| `settings-store.ts` (load, save, debounce, `useSetting`, `uiScale`) | Keep |
| `update-store.ts` (state machine, weekly automatic check, friendly errors) | Keep |
| `ui-store.ts` (dialogs, settings page, confirm requests, report draft, reduce motion) | Generalise. `windWanted` and the prop pages are dropped |
| `backup-store.ts` (backup, restore, folder and cloud automation, attention dot) | Generalise. Optional |
| `editor-store.ts` (1,650 lines) | Replaced by `document-store.ts`: current document, dirty flag, save and save as, open, new, draft restore, history, toasts. This takes the most work |

### 2.5 Interface (`panels/`, `components/`, `pages/`, `app/`)

| Piece | Source | Plan |
|---|---|---|
| App frame: theme and scale, global shortcuts, update check after start, close request flow, resizable side panels saved in settings | `app/App.tsx` | Generalise |
| Menu bar as the title bar: menus built from commands, drag region, Windows buttons, Mac inset, name field with unsaved dot, split Save button | `panels/MenuBar.tsx` | Generalise |
| Status bar with hover hints | `StatusBar.tsx`, `status-hint.ts` | Keep |
| Command palette | `CommandPalette.tsx` | Keep |
| Settings window: side list, search, spec-driven rows, key capture, Storage, Backup, Recently removed, update row, About | `SettingsDialog.tsx` | Generalise. Pages register per feature |
| Confirm, Close ("unsaved, close anyway?") and Closing ("finishing a backup…") dialogs | `ConfirmDialog`, `CloseDialog`, `ClosingDialog` | Keep |
| Save dialog (name it before saving) | `SaveDialog.tsx` | Keep |
| Toast with actions (Undo, Show) | `Toast.tsx` | Keep |
| What's new after an update | `WhatsNewDialog.tsx` | Keep |
| Guided tour that follows its targets every frame, one tour per page, replay from Help | `Tour.tsx`, `tour-steps.ts` | Keep the engine. The example app gets a three-step tour |
| Report a problem dialog | `ReportDialog.tsx` | Keep. Optional |
| Restore dialog and cloud setup dialog | `RestoreDialog`, `CloudSetupDialog` | Generalise. Optional |
| Export dialog: folder, existing files, replace, show when done | `ExportDialog.tsx`, `export-replace` test | Example. It exports a note as `.md` and `.txt`, so the whole flow is shown |
| Batch export | `BatchExportDialog.tsx` | Example. Export many documents at once, with progress and `afterPaint` |
| Picture dialog (save an image) | `PictureDialog.tsx` | Drop. `savePictureFile` stays in the platform layer |
| Controls: Tooltip, Switch, Select, Dialog, Keys | `components/controls.tsx` | Keep |
| Property row with reset button | `PropertyRow.tsx` | Keep |
| Colour picker and colour row | `ColourPicker`, `ColourRow` | Keep. The colour setting needs them |
| Palette menu, presets, seed, variations, outliner, details, parts, pieces | many | Drop |
| Home page | `GalleryPage.tsx` | Example. A Home page with New, Open and recent documents |
| "Your props" page: grid, side panel, sort, groups, search, multi-select, bin | `YourPropsPage`, `RemovedProps`, `prop-tile` | Generalise into "Your documents". This is a good, reusable library page |
| Styles | `styles/tokens.css`, `styles/app.css` (3,950 lines) | Split up. Keep Shell, Menu bar, Buttons, Fields, Status bar, Dialogs, Command palette, Settings, Toast, Tour, Home and library. Drop Left panel, Outliner, Details and Viewport. One CSS file per area |

### 2.6 Build, release and repository

| Piece | Plan |
|---|---|
| `Makefile` (help, install, hooks, dev, web, build, installer, mac, dmg, release, test, lint, check, clean; Git Bash on Windows) | Keep. Drop `previews` |
| `Taskfile.yml`, `build/Taskfile.yml`, `build/windows`, `build/darwin`, NSIS script, manifest, `make_dmg.sh` | Keep. The names come from `build/config.yml` |
| `build/config.yml` (`info` is the source of the name and version) | Keep. It becomes the one source of truth |
| Release workflow (on release or by hand, Windows installer plus Mac DMG and update zip, version check) | Keep. The version check reads `core/version.ts` |
| Git hooks (lint on commit, tests on push) | Keep |
| `.golangci.yml`, `eslint.config.js` (including the rule that keeps React out of pure code) | Keep. The pure-code rule moves to `core/` |
| Issue templates (bug, feature) and PR template, plus the test that keeps them matching the report forms | Keep. Drop `prop_request.yml` |
| `CONTRIBUTING.md`, `AGENTS.md`, `CLAUDE.md` | Rewrite them short and generic |
| `docs/terminology.md` (button voice, error voice, words never shown) | Keep the voice rules and drop the 3D words. It's the template's style guide |
| `.claude/skills/release`, `try-in-browser` | Keep, made generic. Drop `add-prop` |
| `CHANGELOG.md` | Start fresh at 0.1.0 |
| `specs/`, `docs/*-trees.md`, `engine-kits/`, `draw-previews.html`, `graphify-out/` | Drop |

### 2.7 Dependencies

- Keep: Wails 3.1, React 19, HeroUI 3, react-aria, Tailwind 4, lucide-react, zod, zustand, Vite 7,
  Vitest 5, Testing Library, ESLint 10, TypeScript 5.
- Keep only if cloud backup stays: `aws-sdk-go-v2` and its S3 packages.
- Keep only if secrets stay: `zalando/go-keyring`.
- Drop: `three` and `@types/three`. Check whether `@internationalized/date` is still used, and
  drop it if not.

---

## 3. New in the template (easy-props doesn't have these)

1. **One config for identity.** `app.config.json` (or `build/config.yml` `info`, plus a
   `github` block) holds the name, product ID, company, description, GitHub owner and repo.
   Go reads it through an embedded copy, and the frontend imports it.
2. **One version source.** Five files are checked today. `make version V=1.2.3` writes all of
   them, and a test fails if they disagree.
3. **Rename script.** `make rename NAME="My App" ID=com.me.myapp REPO=me/my-app`, written as a
   small Go program in `tools/rename` so it runs the same on Windows and Mac. A test then
   looks for any leftover `wails-desktop-template`.
4. **Example "Notes" app.** It covers the full set of patterns with almost no domain code: a
   document type, editor, undo, autosave, save and open, library page, export, backup, a
   settings entry of its own, commands and a tour.
5. **Feature registry.** `frontend/src/features/index.ts` lists the optional features. Each
   one gives its commands, settings pages, menu items, dialogs and startup hook. On the Go
   side, each feature is its own file group behind a build-free `Enable…` call in `main.go`.
6. **`docs/removing-features.md`.** Steps to remove each optional feature cleanly.
7. **Start with the system (Windows and Mac).** The Fyne template had this. It's off by
   default and has a setting. See decision D4.
8. **README** with a screenshot, what's included, quick start, renaming, releasing, signing
   and notarising (Mac builds are ad-hoc signed until a Developer ID is added), and the
   features table.

---

## 4. Target layout

```
wails-desktop-template/
├── main.go                     window, tray, single instance, middleware
├── app.config.json             name, id, repo: the one place to rename
├── backend/
│   ├── app.go                  service, lifecycle, close guard, dialogs
│   ├── window.go  tray.go  system*.go  settings.go  draft.go
│   ├── fsutil/                 atomic writes, safe names, reveal in file manager
│   ├── update/                 GitHub check, Windows installer, Mac updater
│   ├── export/                 folder dialog, write files, existing files
│   ├── documents/              library, pictures handler, index, bin
│   ├── backup/                 zip backup, restore, folder automation
│   ├── cloud/                  S3 store, cloud backup        (optional)
│   └── secrets/                keychain                       (optional)
├── frontend/src/
│   ├── platform/               the only code that knows about Go
│   ├── core/                   pure code: settings spec, commands, history, changelog, yield, files
│   ├── store/                  settings, ui, update, document
│   ├── shell/                  MenuBar, StatusBar, CommandPalette, SettingsDialog, Toast, Tour, dialogs
│   ├── components/             controls, PropertyRow, ColourPicker
│   ├── features/               backup, cloud, bin, export, report, tour: each optional
│   ├── example/                Notes: the part a new app replaces
│   ├── styles/                 tokens.css + one file per area
│   └── tests/
├── build/  Makefile  Taskfile.yml  .github/  .githooks/
├── tools/rename/
└── docs/  terminology.md  removing-features.md  releasing.md
```

---

## 5. Phases

Every phase ends with `make check` passing and the app opening with `make dev`.

1. **Copy the base.** Copy the tooling, build files, `main.go`, `backend/` and `frontend/` from
   easy-props 0.4.7 into this folder. Run `git init` on `dev`, with no easy-props history.
   Delete `assets/`, `scene/`, `export/` (except `yield.ts`), the viewport, engine kits,
   previews and specs.
2. **Make it build again.** Remove what pointed at the deleted code: App, MenuBar, commands,
   settings spec, editor store. Expect this phase to be a stub for a short while.
3. **Rename the identity.** Add `app.config.json`, the error-prefix constant, config-driven
   updater, report and About URLs, `core/version.ts`, `make version`, the rename tool and the
   leftover-name test.
4. **Reshape the backend.** Move Go into the subpackages in section 4. Props become documents.
   Secrets become generic. Keep every test passing as files move.
5. **Reshape the frontend shell.** Add `document-store.ts`, the command and settings-page
   registries, and the `features/` folder. Move backup, cloud, bin, export, report and tour
   into it.
6. **Build the Notes example.** Document type, editor, Home, Your documents, export, batch
   export, tour steps.
7. **Split the CSS.** Divide it into area files and drop the unused sections. Check light,
   dark and 80–200% scale by eye.
8. **Docs.** README, AGENTS, CONTRIBUTING, terminology, removing features, releasing, and
   CHANGELOG 0.1.0.
9. **Real-world checks.**
   - Windows installer: build it, install it, then publish a test release `v0.1.1` to a
     scratch repository and make sure 0.1.0 finds it, downloads it and installs on close.
   - Mac: build the DMG and the update zip, and test the same update path if a Mac is
     available. Otherwise say clearly that it wasn't tested.
   - Rename test: run the rename tool on a copy, build it, and check that the tray, title,
     installer name and settings folder all use the new name.
10. **Publish.** You push to GitHub and mark it as a template repository.

---

## 6. Decisions for you

| # | Question | My default |
|---|---|---|
| D1 | Repository name | `wails-desktop-template` |
| D2 | Linux build and updater | Not now. Windows and Mac only, said plainly in the README. Linux could be added later with an AppImage |
| D3 | Cloud backup (S3) in the template | Keep it as an optional feature. It's the heaviest piece, but it's tested and hard to write again |
| D4 | Add "start with the system" | Yes. Off by default |
| D5 | Example app | Notes |
| D6 | Keep HeroUI and Tailwind | Yes. The look depends on them |
| D7 | Words on screen style guide (`terminology.md`) | Keep the voice rules as the template's default |

---

## 7. Risks

- **`editor-store.ts` is 1,650 lines and holds most of the shell's state.** Pulling the
  document lifecycle out of it (dirty flag, save, draft, close) is where things are most
  likely to break. The close-guard and draft tests in easy-props are the safety net.
- **The updater can only really be tested with a real GitHub release.** Use a scratch
  repository so the template's own releases stay clean.
- **The Mac updater and signing were tested on easy-props, but not after renaming.** Bundle
  ID changes affect the Keychain entry and the updater's app check.
- **CSS split.** Sections in `app.css` depend on each other in places. Check by eye at
  several scales, not only with tests.
