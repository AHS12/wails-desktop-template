# Build files

Wails 3 builds the app with the tasks in `Taskfile.yml` at the repository root and in each
folder here. `make` runs them for you.

## Written from app.config.json

Don't edit these by hand: `make rename` and `make version` write them from
`appconfig/app.config.json`, and `make check` fails when one drifts.

- `config.yml`
- `windows/info.json`, `windows/wails.exe.manifest`, `windows/nsis/wails_tools.nsh`
- `darwin/Info.plist`, `darwin/Info.dev.plist`
- `linux/nfpm/nfpm.yaml`, `linux/app.desktop`

## Icons

- `appicon.png`: the icon, 1024×1024. `wails3 task common:generate:icons` makes the
  Windows `.ico` and Mac `.icns` from it.
- `appicon.svg`: the Linux build draws its menu icons from this at every size, named after
  the app's id, into `linux/icons` (not kept in git).

## Windows

- `windows/nsis/project.nsi`: the installer. It installs for the current user, closes a
  running copy before an update, and keeps saved work when uninstalling.

## macOS

- `darwin/make_dmg.sh`: packs `bin/<id>.app` into a disk image. Workflows run it through
  `bash`, so it works even if git lost its executable bit.

## Linux

Built on Linux, as CI does on Ubuntu 24.04, with `build-essential pkg-config libgtk-4-dev
libwebkitgtk-6.0-dev librsvg2-bin` installed.

- `wails3 task linux:package` makes the .deb, .rpm and Arch package from
  `linux/nfpm/nfpm.yaml`. They install the program to `/usr/bin`, the menu entry as
  `/usr/share/applications/<bundle id>.desktop`, and the icons.
- `wails3 task linux:appimage` makes the AppImage, with linuxdeploy pinned to a release
  and checked against its SHA-256 in `linux/Taskfile.yml`.
- The menu entry is named after the bundle id because `main.go` sets that as the GTK
  application id; the desktop matches the two to show the window's icon.

The app and the installers are built into `bin` at the repository root, and `make
installer` and `make dmg` copy the release files into `build/dist`.
