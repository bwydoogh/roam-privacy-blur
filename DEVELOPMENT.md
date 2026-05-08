# Development

Roam Privacy Blur is a Roam Depot-ready extension. The public `README.md` is written for Roam Depot users; this file contains local development, test, and release notes.

## Files

- `extension.js`: Roam Depot extension entrypoint.
- `dev-server.mjs`: dependency-free local server with CORS headers.
- `test-harness/index.html`: local browser test page that loads `extension.js`.

## Local Test Without Roam

Start the local server:

```sh
npm run dev
```

Open the URL printed by the server, usually:

```text
http://localhost:8787/test-harness/
```

If port `8787` is already in use, the server automatically tries the next ports.

The harness includes mock Roam settings controls for the unlock method, unlock key, and pause duration. Changing those controls should apply immediately without reloading the extension.

Use `Focus Loss` to dispatch the same blur event used by the extension. The topbar pause button should prevent that event from locking the page while privacy blur is paused.

## Local Test In Roam

Start the local server:

```sh
npm run dev
```

### Roam Depot Development Mode

In Roam Depot settings:

1. Enable development mode.
2. Use the folder picker to load this local repository folder.
3. Open the extension settings tab named `Privacy Blur`.
4. Test every unlock mode and verify settings persist after refreshing Roam.
5. Verify the pause button appears in the Roam topbar.
6. Verify focus loss does not blur Roam while paused, then resumes normal blur behavior after clicking the button again.
7. Verify `Pause duration` options:
   - `untilClickedAgain`: focus loss stays ignored until manually resumed.
   - `untilNextFocusLoss`: first focus loss is ignored and pause automatically ends.
   - timer options automatically resume privacy blur after their timer expires.

### Load Extension From URL

In Roam Depot development mode, choose `Load extension from URL` and enter the local extension URL printed by the dev server:

```text
http://localhost:8787/extension.js
```

If the server printed a different port, replace `8787` with that printed port.

This path receives Roam's extension API, so the native `Privacy Blur` settings tab should be available.

After pushing to GitHub, test a fixed commit through jsDelivr:

```text
https://cdn.jsdelivr.net/gh/bwydoogh/roam-privacy-blur@COMMIT_SHA/extension.js
```

Replace `COMMIT_SHA` with the commit you want to test.

### Manual roam/js Import

Manual `roam/js` import is useful as a fallback smoke test, but it does not receive Roam's `extensionAPI`, so it cannot create the native settings panel.

```javascript
{{[[roam/js]]}}
(async () => {
  const module = await import("http://localhost:8787/extension.js?t=" + Date.now());
  window.roamPrivacyBlurExtension?.onunload?.();
  window.roamPrivacyBlurExtension = module.default;
  window.roamPrivacyBlurExtension.onload();
})();
```

To test a non-default unlock method through `roam/js`, pass options to `onload()`:

```javascript
window.roamPrivacyBlurExtension.onload({
  unlockMode: "key",
  unlockKey: "Escape",
});
```

Supported manual values are `singleClick`, `doubleClick`, `tripleClick`, and `key`.

## Checks

Run syntax checks:

```sh
npm run check
```

Check for whitespace errors before committing:

```sh
git diff --check
```

## Release Checklist

1. Run `npm run check`.
2. Run `git diff --check`.
3. Test via Roam Depot development mode from the local folder.
4. Test via `Load extension from URL` using a fixed jsDelivr commit URL.
5. Verify the topbar pause button appears and resets to active privacy blur behavior after reload.
6. Commit and push the final release state.
7. Use the final commit hash in the Roam Depot metadata file.

Roam Depot metadata:

```json
{
  "name": "Roam Privacy Blur",
  "short_description": "Blurs your Roam graph when the browser window or tab loses focus.",
  "author": "Benny Wydooghe",
  "tags": ["privacy", "focus", "blur"],
  "source_url": "https://github.com/bwydoogh/roam-privacy-blur",
  "source_repo": "https://github.com/bwydoogh/roam-privacy-blur.git",
  "source_commit": "FINAL_COMMIT_SHA"
}
```

Submit that metadata as `extensions/bwydoogh/roam-privacy-blur.json` in a pull request to `Roam-Research/roam-depot`.
