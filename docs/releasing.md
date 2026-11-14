# Releasing

Releases are built on GitHub from a tag, and the app finds updates by the files attached
to the newest release. Pushing, merging and publishing are for a person to do.

## 1. Set the version

```bash
make version V=0.2.0
```

That writes the version into `appconfig/app.config.json` and every build file that holds
it: `build/config.yml`, the Windows `info.json`, manifest and installer script, and the
Mac `Info.plist` files. The frontend and Go read it from `app.config.json`. `make check`
fails if any of them drift.

## 2. Write the changelog

Add the version to the top of `CHANGELOG.md`. What's new reads this file, so keep to the
shapes `frontend/src/core/changelog.ts` understands:

```markdown
## 0.2.0 (December 1, 2026)

**A group title**

- One thing that changed, in words someone using the app would use.
```

Write what people will notice, not how it was done. A test fails if the top version isn't
the app's version.

## 3. Check

Run `make check`, then build an installer and try it with `make release` (a Windows
installer on Windows, a DMG on a Mac).

## 4. Publish

1. Commit on `dev`, push, and merge `dev` into `main`.
2. Publish a GitHub Release tagged `v0.2.0`, or run the **Release Installers** workflow under
   Actions with the tag and the platforms. The workflow makes the release from the chosen
   branch if it doesn't exist yet, and otherwise rebuilds and replaces its files.
3. The tag has to match `app.config.json`, or the run stops before building.
4. When it finishes, check the release has the Windows installer, the Mac DMG and the Mac
   zip. The app finds updates by these names, `<id>-<version>-windows-amd64-setup.exe`,
   `<id>-<version>-mac-universal.dmg` and `<id>-<version>-mac-universal.zip`, and a test
   fails if the workflow and the app disagree. A Mac updates itself from the zip.

## Trying an update before publishing it

Set `APP_UPDATE_REPOSITORY` to another repository, such as a fork with a test release, and
start the app. It looks for updates there instead, so an update can be tried end to end
without offering it to everyone.

## Signing

The builds aren't signed, so Windows SmartScreen and macOS Gatekeeper warn on first
launch. A Mac build is signed for that Mac only (ad-hoc). To sign properly, add a Windows
code-signing certificate, and a Mac Developer ID with notarisation, to the release
workflow; `build/windows/Taskfile.yml` and `build/darwin/Taskfile.yml` have `sign` tasks.
A Mac's update check and its keychain entry depend on the bundle id, so keep it once
people have the app.
