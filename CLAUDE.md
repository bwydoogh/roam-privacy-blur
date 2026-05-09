# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the local dev server on `http://localhost:8787` (auto-bumps the port if taken). Serves `extension.js` with CORS headers so Roam can load the extension via `Load extension from URL`.
- `npm run check` — `node --check` syntax check on `extension.js` and `dev-server.mjs`. There are no unit tests; verification happens in Roam Depot dev mode (folder picker against this repo) or via `Load extension from URL`.
- `git diff --check` — required pre-commit whitespace check.

There is no build step or bundler. `extension.js` is the shipped artifact, loaded directly by Roam Depot or jsDelivr.

## Architecture

This repo is a single-file Roam Research extension. The whole runtime lives in `extension.js` and exports `{ onload, onunload }` per the Roam Depot extension contract.

Key pieces that span the file and are easy to miss:

- **Two configuration paths.** When loaded by Roam Depot, `onload({ extensionAPI })` reads/writes settings through `extensionAPI.settings` and renders the native `Privacy Blur` settings panel via `createSettingsPanel`. When loaded manually (e.g. via the `roam/js` import workflow documented in `DEVELOPMENT.md`), `extensionAPI` is absent and settings come from the `manualOptions` argument to `onload`, stored in module-level `fallback*` variables. `readUnlockOptions` / `getStoredSetting` branch on which path is active. Any new setting must be wired through both paths.
- **Lock state is a single CSS class.** `lock()` / `unlock()` toggle `roam-privacy-blur-locked` on `<html>`. The injected stylesheet (`STYLE_ID`) blurs `body > *` and the Roam app selectors via the `--roam-privacy-blur-filter` CSS variable, and shows a fullscreen `#roam-privacy-blur-overlay` that captures interaction. The pause button is explicitly excluded from the blur (`filter: none`) so it remains clickable while locked.
- **Unlock handler is re-registered on every settings change.** `registerUnlockHandler` swaps between a `keydown` listener on `document` (for `unlockMode === "key"`) and a `click` listener on the overlay that checks `event.detail` against `CLICK_UNLOCK_COUNTS` (1/2/3 for single/double/triple). Always tear down the previous handler via `cleanupUnlockHandler` before installing a new one.
- **Pause button is injected into Roam's topbar.** `installPauseButton` finds the topbar via `ROAM_TOPBAR_SELECTORS` and uses a `MutationObserver` on `document.body` to re-attach the button when Roam re-renders the topbar. The pause state has four behaviors driven by `PAUSE_DURATIONS` (`untilClickedAgain`, timed, `untilNextFocusLoss`); the `untilNextFocusLoss` case is special — it is consumed inside `lock()` itself.
- **Lock triggers.** Three events drive `lock()`: `window blur`, `window pagehide`, and `document visibilitychange` (only when `hidden`). Returning focus does not unlock — that is intentional.
- **Cleanup must be idempotent.** `onload` first calls any existing `cleanup` (preferring the module-local one, falling back to `window.__roamPrivacyBlurCleanup` from a previous module instance). The closure stored in `cleanup` removes listeners, the overlay, the style tag, the pause button, the CSS variable, and the lock class. Roam Depot dev mode reloads the module on file change, so any new resource added in `onload` must be removed in `cleanup`.

`dev-server.mjs` is a dependency-free static file server with CORS headers that picks an available port. Its only purpose is to serve `extension.js` to Roam's `Load extension from URL` from `localhost`.

## Release

Releases are pinned commits referenced from the Roam Depot metadata file `extensions/bwydoogh/roam-privacy-blur.json` in the `Roam-Research/roam-depot` repo. The release checklist in `DEVELOPMENT.md` is the source of truth — in particular, every release must be smoke-tested via both Roam Depot dev mode (local folder) and `Load extension from URL` against a fixed jsDelivr commit URL before the commit SHA is submitted.
