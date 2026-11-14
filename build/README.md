# Build files

Wails 3 builds the app with the tasks in `Taskfile.yml` at the repository root and in each
folder here. `make` runs them for you.

- `config.yml`, `windows/info.json`, `windows/wails.exe.manifest`,
  `windows/nsis/wails_tools.nsh`, `darwin/Info.plist` and `darwin/Info.dev.plist` carry the
  app's name, ids and version. Don't edit those by hand: they're written from
  `appconfig/app.config.json` by `make rename` and `make version`, and `make check` fails
  when one drifts.
- `appicon.png`: the icon, 1024×1024. `wails3 task common:generate:icons` makes the Windows
  `.ico` and Mac `.icns` from it.
- `windows/nsis/project.nsi`: the installer. It installs for the current user, closes a
  running copy before an update, and keeps saved work when uninstalling.
- `darwin/make_dmg.sh`: packs `bin/<id>.app` into a disk image.

The app and the Windows installer are built into `bin` at the repository root, and
`make installer` and `make dmg` copy the release files into `build/dist`.
