# Roam Privacy Blur

Roam Privacy Blur blurs your Roam Research graph when the browser window or tab loses focus.

When you return to Roam, the content stays blurred until you unlock it. This helps keep your graph private when sharing a screen, switching windows, or leaving Roam visible in the background.

## Behavior

- Roam locks when the window loses focus, the tab becomes hidden, or the page is being hidden.
- Returning focus to Roam does not unlock the content.
- By default, a left-button triple-click anywhere in the blurred Roam window unlocks Roam.
- The blur covers the graph content and prevents interaction while locked.
- A topbar button can pause privacy blur temporarily. While paused, focus loss does not blur Roam. Pause can last until clicked again, for a short timer, until the next focus loss, or until Roam reloads.

## Settings

Open the extension settings tab named `Privacy Blur`.

- `Unlock method`: choose `Single left-click`, `Double left-click`, `Triple left-click`, or `Keyboard key`.
- `Unlock key`: used only when `Keyboard key` is selected. The default is `Escape`.
- `Pause duration`: choose how long the topbar pause button keeps privacy blur disabled.

## Privacy

Roam Privacy Blur runs entirely in your browser.

It does not send graph content anywhere, does not use external services, and does not store your notes. The only saved values are the extension settings managed by Roam.

## Disable

To stop using the extension, disable or uninstall it from Roam Depot. Unloading the extension removes its blur overlay, styles, event listeners, and lock state.
