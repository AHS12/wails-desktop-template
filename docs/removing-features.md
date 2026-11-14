# Removing a feature

Four features are optional: **Export**, **Backup** (to a file, a folder and the cloud),
**Report a problem** and the **Tour**. Each lives in a folder of its own on each side, and
nothing outside those folders imports it: ESLint fails if the shell, the stores, `core/` or
`platform/` ever do. So taking one out is deleting folders and a few named lines.

After any of these, run `make check`. Each set of steps below was tried on a copy of the
template, and left types, lint, tests and the Go build passing.

## Export

1. Delete `frontend/src/features/export` and `backend/export`.
2. Delete `frontend/src/example/note-export.ts`, the example's formats.
3. In `frontend/src/features/index.ts`, delete the `exporting` and `NOTE_FORMATS` imports
   and the `exporting(NOTE_FORMATS),` line.
4. In `frontend/src/platform/shell.ts`, delete `export: 'backend/export.Files',` from
   `SERVICES`.
5. In `main.go`, delete the `backend/export` import, `exports := export.New()` and
   `application.NewService(exports),`.

## Backup

Backups to a file, to a folder and to the cloud go together, since cloud backup is built
on the same backup format.

1. Delete `frontend/src/features/backup`, `backend/backup` and `backend/secrets`.
2. In `frontend/src/features/index.ts`, delete the `backup` import and the `backup,` line.
3. In `frontend/src/platform/shell.ts`, delete `backup: 'backend/backup.Service',` from
   `SERVICES`.
4. In `main.go`, delete the `backend/backup` and `backend/secrets` imports, the
   `backups := backup.New(…)` line, the `backup.HeldPicturePrefix` picture route and
   `application.NewService(backups),`.
5. Run `go mod tidy`. It drops the AWS SDK and the keychain library, which only backups used.

The settings file keeps `folderBackup` and `cloudBackup` entries that nothing reads any
more. They do no harm; to tidy them away, delete them from `SettingsFile`, `DEFAULT_SETTINGS`
and the schema in `frontend/src/core/settings/settings-spec.ts`.

### Only cloud backup

Cloud backup is the files named `cloud*.go` in `backend/backup`, `CloudSetupDialog.tsx`,
`CloudStatusFacts.tsx`, `cloud-services.ts` and the cloud parts of `backup-store.ts` and
`BackupSettings.tsx` in `frontend/src/features/backup`. It shares the backup feature's
store and settings page, so taking out only the cloud is an edit rather than a deletion:
start from the `CloudBackupRows` section of `BackupSettings.tsx` and follow the type errors.

## Report a problem

1. Delete `frontend/src/features/report`.
2. In `frontend/src/features/index.ts`, delete the `report` import and the `report,` line.
3. If issues aren't wanted at all, delete `.github/ISSUE_TEMPLATE` too. Otherwise keep it:
   GitHub uses the templates whether or not the app offers the form.

About in Settings offers Report a problem only when the feature is there, so nothing else
changes.

## Tour

1. Delete `frontend/src/features/tour`.
2. Delete `frontend/src/example/tours.ts`, the example's tour steps.
3. In `frontend/src/features/index.ts`, delete the `tour` and `TOURS` imports and the
   `tour(TOURS),` line.

What's new waits for nothing then, and opens after an update as soon as the app starts.
The settings `tourSeen` and `homeTourSeen` stay, unused, in the settings file.

## Adding one

A feature is a `Feature` from `frontend/src/shell/feature.ts`: commands, a group in a menu,
settings pages and rows, dialogs, work at start and before closing, and parts of Home and
the library page. Make a folder in `frontend/src/features`, export the feature from its
`index.ts`, and add it to `FEATURES` in `features/index.ts`. Its styles go in the same
folder, imported from its `index.ts`.

If it needs Go, make a package in `backend/` with a service type, register it in `main.go`,
and add it to `SERVICES` in `frontend/src/platform/shell.ts`. A service gets the data folder
and a way to send events through `backend.Shell`; `backend/export` is the smallest example.
