---
name: try-in-browser
description: Run the app's interface and check a change by looking at it. Use after any visual, layout or interaction change, or when asked to run or screenshot the app.
---

# Trying a change in the browser

## Start it

Run `make web`, or use your tool's preview feature with `pnpm --dir frontend dev`. Vite
prints the address. For Claude Code's preview, `.claude/launch.json` is ignored by git, and
any path in it needs forward slashes.

The browser has no Go backend, so nothing that needs a native dialog or the disk is real
there: the library is empty, backups are unavailable, and an export downloads its files.
For those, use `make dev`, or drive a development build of the desktop app from a script
by starting it with `APP_DEBUG_PORT=9333` and connecting to WebView2's DevTools port.

## Don't trust a hidden pane

A hidden or background browser tab throttles animation frames, which leads to false results:

- Menus and dialogs opened by script can stay half faded.
- Screenshots can show the page before the last change.

Keep the page visible when you're looking at motion. Use real clicks instead of scripted
ones where you can, read the page's text to confirm what a picture can't, and say plainly
if you couldn't check something.

## What to check

- The thing you changed, by using it, not only by reading the page text.
- The browser console, for errors.
- Interface scale at 90%, 100% and 130% for layout changes, especially dropdowns,
  dialogs and tooltips near the window's edge.
- Light and dark themes, for colour changes.
- A narrow window, for the library page and the toolbar.

Tell the user what you saw, and which of these you didn't get to.
