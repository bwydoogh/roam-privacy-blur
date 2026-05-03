const CLASS_LOCKED = "roam-privacy-blur-locked";
const STYLE_ID = "roam-privacy-blur-style";
const OVERLAY_ID = "roam-privacy-blur-overlay";
const ROAM_APP_SELECTORS = [".roam-body", ".roam-app", "#app"];
const SETTINGS = {
  unlockMode: "unlockMode",
  unlockKey: "unlockKey",
};
const DEFAULT_UNLOCK_MODE = "tripleClick";
const DEFAULT_UNLOCK_KEY = "Escape";
const CLICK_UNLOCK_COUNTS = {
  singleClick: 1,
  doubleClick: 2,
  tripleClick: 3,
};

let cleanup = null;
let cleanupUnlockHandler = null;
let extensionSettings = null;
let fallbackUnlockOptions = {};
let isLoaded = false;
let currentUnlockOptions = {
  unlockMode: DEFAULT_UNLOCK_MODE,
  unlockKey: DEFAULT_UNLOCK_KEY,
};

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

function ensureOverlay() {
  let overlay = document.getElementById(OVERLAY_ID);

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.setAttribute("aria-hidden", "true");
    document.body.appendChild(overlay);
  }

  return overlay;
}

function lock() {
  document.documentElement.classList.add(CLASS_LOCKED);
}

function unlock() {
  document.documentElement.classList.remove(CLASS_LOCKED);
}

function isLocked() {
  return document.documentElement.classList.contains(CLASS_LOCKED);
}

function onVisibilityChange() {
  if (document.visibilityState === "hidden") {
    lock();
  }
}

function getStoredSetting(id, fallback) {
  if (!extensionSettings) {
    return fallback;
  }

  const value = extensionSettings.get(id);
  return value === null || typeof value === "undefined" || value === ""
    ? fallback
    : value;
}

async function ensureSettingDefault(id, fallback) {
  if (!extensionSettings) {
    return;
  }

  const value = extensionSettings.get(id);
  if (value === null || typeof value === "undefined" || value === "") {
    await extensionSettings.set(id, fallback);
  }
}

function normalizeUnlockOptions(options = {}) {
  const mode = options.unlockMode;
  const unlockMode =
    mode === "key" ||
    Object.prototype.hasOwnProperty.call(CLICK_UNLOCK_COUNTS, mode)
      ? mode
      : DEFAULT_UNLOCK_MODE;
  const unlockKey =
    typeof options.unlockKey === "string" && options.unlockKey.trim()
      ? options.unlockKey.trim()
      : DEFAULT_UNLOCK_KEY;

  return {
    unlockMode,
    unlockKey,
  };
}

function readUnlockOptions() {
  return normalizeUnlockOptions({
    unlockMode: extensionSettings
      ? getStoredSetting(SETTINGS.unlockMode, DEFAULT_UNLOCK_MODE)
      : fallbackUnlockOptions.unlockMode,
    unlockKey: extensionSettings
      ? getStoredSetting(SETTINGS.unlockKey, DEFAULT_UNLOCK_KEY)
      : fallbackUnlockOptions.unlockKey,
  });
}

function getChangeValue(eventOrValue) {
  if (eventOrValue?.target) {
    if (typeof eventOrValue.target.value !== "undefined") {
      return eventOrValue.target.value;
    }

    if (typeof eventOrValue.target.checked !== "undefined") {
      return eventOrValue.target.checked;
    }
  }

  return eventOrValue;
}

function persistSetting(id, value) {
  if (!extensionSettings?.set || typeof value === "undefined") {
    return;
  }

  try {
    const result = extensionSettings.set(id, value);
    result?.catch?.((error) => {
      console.error("[roam-privacy-blur] failed to save setting:", error);
    });
  } catch (error) {
    console.error("[roam-privacy-blur] failed to save setting:", error);
  }
}

function handleUnlockEvent(event) {
  event.preventDefault();
  event.stopPropagation();
  unlock();
}

function registerUnlockHandler(overlay, options) {
  if (cleanupUnlockHandler) {
    cleanupUnlockHandler();
    cleanupUnlockHandler = null;
  }

  currentUnlockOptions = normalizeUnlockOptions(options);

  if (currentUnlockOptions.unlockMode === "key") {
    const onKeyDown = (event) => {
      if (!isLocked() || event.key !== currentUnlockOptions.unlockKey) {
        return;
      }

      handleUnlockEvent(event);
    };

    document.addEventListener("keydown", onKeyDown, true);
    cleanupUnlockHandler = () => {
      document.removeEventListener("keydown", onKeyDown, true);
    };
    return;
  }

  const unlockClickCount = CLICK_UNLOCK_COUNTS[currentUnlockOptions.unlockMode];
  const onClick = (event) => {
    if (event.button !== 0 || event.detail < unlockClickCount) {
      return;
    }

    handleUnlockEvent(event);
  };

  overlay.addEventListener("click", onClick, true);
  cleanupUnlockHandler = () => {
    overlay.removeEventListener("click", onClick, true);
  };
}

function refreshUnlockHandler(overrides = {}) {
  if (!isLoaded) {
    return;
  }

  const overlay = ensureOverlay();
  registerUnlockHandler(overlay, {
    ...readUnlockOptions(),
    ...overrides,
  });
}

function createSettingsPanel(extensionAPI) {
  if (!extensionAPI?.settings?.panel?.create) {
    return;
  }

  extensionAPI.settings.panel.create({
    tabTitle: "Privacy Blur",
    settings: [
      {
        id: SETTINGS.unlockMode,
        name: "Unlock method",
        description: "Choose how to unlock Roam after privacy blur is active.",
        action: {
          type: "select",
          items: ["singleClick", "doubleClick", "tripleClick", "key"],
          options: [
            { value: "singleClick", label: "Single left-click" },
            { value: "doubleClick", label: "Double left-click" },
            { value: "tripleClick", label: "Triple left-click" },
            { value: "key", label: "Keyboard key" },
          ],
          onChange: (eventOrValue) => {
            const unlockMode = getChangeValue(eventOrValue);
            persistSetting(SETTINGS.unlockMode, unlockMode);
            refreshUnlockHandler({
              unlockMode,
            });
          },
        },
      },
      {
        id: SETTINGS.unlockKey,
        name: "Unlock key",
        description: "Only used when the unlock method is Keyboard key. Match is case-sensitive, for example Escape.",
        action: {
          type: "input",
          onChange: (eventOrValue) => {
            const unlockKey = getChangeValue(eventOrValue);
            persistSetting(SETTINGS.unlockKey, unlockKey);
            refreshUnlockHandler({
              unlockKey,
            });
          },
        },
      },
    ],
  });
}

async function onload(options = {}) {
  if (cleanup) {
    cleanup();
  }

  const { extensionAPI, ...manualOptions } = options;
  extensionSettings = extensionAPI?.settings || null;
  fallbackUnlockOptions = extensionSettings
    ? {}
    : normalizeUnlockOptions(manualOptions);

  await ensureSettingDefault(SETTINGS.unlockMode, DEFAULT_UNLOCK_MODE);
  await ensureSettingDefault(SETTINGS.unlockKey, DEFAULT_UNLOCK_KEY);
  createSettingsPanel(extensionAPI);

  const style = ensureStyle();
  const overlay = ensureOverlay();
  isLoaded = true;
  registerUnlockHandler(overlay, readUnlockOptions());

  window.addEventListener("blur", lock);
  window.addEventListener("pagehide", lock);
  document.addEventListener("visibilitychange", onVisibilityChange);

  cleanup = () => {
    window.removeEventListener("blur", lock);
    window.removeEventListener("pagehide", lock);
    document.removeEventListener("visibilitychange", onVisibilityChange);

    if (cleanupUnlockHandler) {
      cleanupUnlockHandler();
      cleanupUnlockHandler = null;
    }

    document.documentElement.classList.remove(CLASS_LOCKED);
    extensionSettings = null;
    fallbackUnlockOptions = {};
    isLoaded = false;

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
