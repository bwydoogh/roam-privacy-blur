# Roam Privacy Blur

Roam Privacy Blur is a small Roam Depot-ready extension that blurs your Roam Research graph when the browser window or tab loses focus. When you return to Roam, the blur stays active until you triple-click with the left mouse button inside Roam.

The goal is simple privacy protection for shared or work environments where Roam might remain visible in the background.

## Behavior

- Roam locks when the window loses focus, the tab becomes hidden, or the page is being hidden.
- Returning focus to Roam does not unlock the content.
- A left-button triple-click anywhere in the blurred Roam window unlocks Roam.
- Unloading the extension removes all event listeners, CSS, overlay DOM, and lock state.

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

Use the test buttons to lock/unlock, or click outside the browser window and return. Once locked, single-click and double-click should do nothing; triple-click should unlock.

## Local Test In Roam

Start the same server:

```sh
npm run dev
```

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

When you change `extension.js`, re-run the block or change the cache-busting query.

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
