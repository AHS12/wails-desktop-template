#!/bin/bash
# Packages bin/<id>.app into a drag-to-Applications disk image. The Makefile passes
# the id from appconfig/app.config.json.
# Uses hdiutil, which every Mac has, so there is nothing extra to install.
set -euo pipefail

APP_ID="${1:?usage: make_dmg.sh APP_ID VERSION}"
VERSION="${2:?usage: make_dmg.sh APP_ID VERSION}"
APP_PATH="bin/$APP_ID.app"
DMG_PATH="build/dist/$APP_ID-$VERSION-mac-universal.dmg"

if [ ! -d "$APP_PATH" ]; then
    echo "error: $APP_PATH not found. Build it first with: make mac" >&2
    exit 1
fi

STAGING_DIR=$(mktemp -d)
trap 'rm -rf "$STAGING_DIR"' EXIT

cp -R "$APP_PATH" "$STAGING_DIR/"
ln -s /Applications "$STAGING_DIR/Applications"

mkdir -p build/dist
rm -f "$DMG_PATH"
hdiutil create -volname "$APP_ID" -srcfolder "$STAGING_DIR" -ov -format UDZO "$DMG_PATH"

echo "Created $DMG_PATH"
