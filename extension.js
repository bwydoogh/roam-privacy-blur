const CLASS_LOCKED = "roam-privacy-blur-locked";
const STYLE_ID = "roam-privacy-blur-style";
const OVERLAY_ID = "roam-privacy-blur-overlay";
const ROAM_APP_SELECTORS = [".roam-body", ".roam-app", "#app"];

let cleanup = null;

const css = `
html.${CLASS_LOCKED} body {
  overflow: hidden;
}

html.${CLASS_LOCKED} body > *:not(#${OVERLAY_ID}) {
  filter: blur(12px) saturate(0.75);
  transition: filter 120ms ease-out;
  pointer-events: none !important;
  user-select: none !important;
}

${ROAM_APP_SELECTORS.map((selector) => `html.${CLASS_LOCKED} ${selector}`).join(",\n")} {
  filter: blur(12px) saturate(0.75);
  transition: filter 120ms ease-out;
  pointer-events: none !important;
  user-select: none !important;
}

#${OVERLAY_ID} {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: none;
  background: transparent;
  cursor: default;
}

html.${CLASS_LOCKED} #${OVERLAY_ID} {
  display: block;
}
`;

function ensureStyle() {
  let style = document.getElementById(STYLE_ID);

  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  return style;
}

function ensureOverlay(onUnlock) {
  let overlay = document.getElementById(OVERLAY_ID);

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.setAttribute("aria-hidden", "true");
    document.body.appendChild(overlay);
  }

  overlay.addEventListener("click", onUnlock, true);
  return overlay;
}

function lock() {
  document.documentElement.classList.add(CLASS_LOCKED);
}

function unlock() {
  document.documentElement.classList.remove(CLASS_LOCKED);
}

function onVisibilityChange() {
  if (document.visibilityState === "hidden") {
    lock();
  }
}

function onTripleClick(event) {
  if (event.button !== 0 || event.detail < 3) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  unlock();
}

function onload() {
  if (cleanup) {
    cleanup();
  }

  const style = ensureStyle();
  const overlay = ensureOverlay(onTripleClick);

  window.addEventListener("blur", lock);
  window.addEventListener("pagehide", lock);
  document.addEventListener("visibilitychange", onVisibilityChange);

  cleanup = () => {
    window.removeEventListener("blur", lock);
    window.removeEventListener("pagehide", lock);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    overlay.removeEventListener("click", onTripleClick, true);
    document.documentElement.classList.remove(CLASS_LOCKED);

    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }

    if (style.parentNode) {
      style.parentNode.removeChild(style);
    }

    cleanup = null;
  };
}

function onunload() {
  if (cleanup) {
    cleanup();
  }
}

export default {
  onload,
  onunload,
};
