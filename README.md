# Roam Privacy Blur

Roam Privacy Blur is a small Roam Depot-ready extension that blurs your Roam Research graph when the browser window or tab loses focus. When you return to Roam, the blur stays active until you use the configured unlock action.

The goal is simple privacy protection for shared or work environments where Roam might remain visible in the background.

## Behavior

- Roam locks when the window loses focus, the tab becomes hidden, or the page is being hidden.
- Returning focus to Roam does not unlock the content.
- By default, a left-button triple-click anywhere in the blurred Roam window unlocks Roam.
- In the Roam extension settings panel, the unlock method can be changed to single-click, double-click, triple-click, or a keyboard key.
- Unloading the extension removes all event listeners, CSS, overlay DOM, and lock state.

## Settings

When installed through Roam Depot, open the extension settings tab named `Privacy Blur`.

- `Unlock method`: `Single left-click`, `Double left-click`, `Triple left-click`, or `Keyboard key`.
- `Unlock key`: used only when `Keyboard key` is selected. The default is `Escape`; key matching is case-sensitive.

If the extension is loaded manually through `roam/js`, Roam's native extension settings panel is not available. In that case, pass options to `onload()` if you want to override the default triple-click unlock behavior.

## Files

- `extension.js`: Roam Depot extension entrypoint.
- `dev-server.mjs`: dependency-free local server with CORS headers.
- `test-harness/index.html`: local browser test page that loads `extension.js`.

## Local Test Without Roam

Start the local server:

```sh
npm run dev
```

Open:

```text
http://localhost:8787/test-harness/
```

If port `8787` is already in use, the server automatically tries the next ports. Use the URL printed by the server.

Use the test buttons to lock/unlock, or click outside the browser window and return. The harness includes mock Roam settings controls for the unlock method and key. Changing those controls should apply immediately without reloading the extension.

## Local Test In Roam

Start the same server:

```sh
npm run dev
```

### Load Extension From URL

In Roam Depot development mode, choose `Load extension from URL` and enter the local extension URL printed by the dev server:

```text
http://localhost:8787/extension.js
```

If the server printed a different port, replace `8787` with that printed port.

This path receives Roam's extension API, so the native `Privacy Blur` settings tab should be available.

After pushing to GitHub, you can also test a fixed commit through jsDelivr:

```text
https://cdn.jsdelivr.net/gh/bwydoogh/roam-privacy-blur@COMMIT_SHA/extension.js
```

Replace `COMMIT_SHA` with the commit you want to test.

### Manual roam/js Import

In your Roam graph, create a temporary block under `[[roam/js]]` and use a cache-busted dynamic import:

```javascript
{{[[roam/js]]}}
(async () => {
  const module = await import("http://localhost:8787/extension.js?t=" + Date.now());
  window.roamPrivacyBlurExtension?.onunload?.();
  window.roamPrivacyBlurExtension = module.default;
  window.roamPrivacyBlurExtension.onload();
})();
```

If the server printed a different port, replace `8787` with that printed port.

To test a non-default unlock method through `roam/js`, pass options to `onload()`:

```javascript
window.roamPrivacyBlurExtension.onload({
  unlockMode: "key",
  unlockKey: "Escape",
});
```

Supported manual values are `singleClick`, `doubleClick`, `tripleClick`, and `key`.

When you change `extension.js`, re-run the block or change the cache-busting query. This manual import path does not receive Roam's `extensionAPI`, so it cannot create the native settings panel.

## Roam Depot Publishing

This repository is structured for Roam Depot:

- `README.md` is required.
- `extension.js` is required and exports `onload` / `onunload`.
- No build step is required.

After pushing this repository to GitHub, submit metadata to `Roam-Research/roam-depot` with the GitHub repository URL and fixed source commit.

## Development

Run syntax checks:

```sh
npm run check
```
