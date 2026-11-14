---
name: release
description: Publish a new version of the app. Use when asked to bump the version, write the changelog for a release, or make a release. Run only when the user asks for it.
disable-model-invocation: true
---

# Releasing a version

Pushing, merging and publishing are outward-facing, so confirm each of them with the user.
[docs/releasing.md](../../../docs/releasing.md) is the full guide; these are the steps.

## 1. Set the version

```bash
make version V=0.2.0
```

It writes `appconfig/app.config.json` and every build file that carries the version. Check
with `git diff` that only versions changed.

## 2. Write the changelog

Add the version to the top of `CHANGELOG.md`, in the shapes `frontend/src/core/changelog.ts`
reads:

```markdown
## 0.2.0 (December 1, 2026)

**A group title**

- One thing that changed, in words someone using the app would use.
```

Write about what people will notice, not about how it was done. Read the commits since the
last release with `git log`, and check each claim against the code: don't call something
new if it's only been improved. A test fails if the top version isn't the app's version.

## 3. Check

Run `make check`, then build and open the installer on whatever you can, with `make release`.

## 4. Publish

1. Commit to `dev`, push, and merge `dev` into `main`.
2. Publish a GitHub Release tagged `vX.Y.Z`, or run the **Release Installers** workflow under
   Actions with the tag and platform.
3. The tag has to match the version, or the run stops before building.
4. When the run ends, check that the Windows installer, the Mac DMG and the Mac zip are all
   attached. The app finds updates by those file names; a test fails if the workflow and
   `backend/update.go` disagree.
