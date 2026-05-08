const CLASS_LOCKED = "roam-privacy-blur-locked";
const STYLE_ID = "roam-privacy-blur-style";
const OVERLAY_ID = "roam-privacy-blur-overlay";
const PAUSE_BUTTON_ID = "roam-privacy-blur-pause-button";
const GLOBAL_CLEANUP_KEY = "__roamPrivacyBlurCleanup";
const ROAM_APP_SELECTORS = [".roam-body", ".roam-app", "#app"];
const ROAM_TOPBAR_SELECTORS = [
  ".rm-topbar",
  ".roam-topbar",
  ".bp3-navbar",
];
const SETTINGS = {
  unlockMode: "unlockMode",
  unlockKey: "unlockKey",
  pauseDuration: "pauseDuration",
  blurIntensity: "blurIntensity",
};
const DEFAULT_UNLOCK_MODE = "tripleClick";
const DEFAULT_UNLOCK_KEY = "Escape";
const DEFAULT_PAUSE_DURATION = "untilClickedAgain";
const DEFAULT_BLUR_INTENSITY = "normal";
const ACTIVE_BUTTON_ICON = '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3v8Z"/></svg>';
const PAUSED_BUTTON_ICON = '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3v8Z"/><path d="m4 4 16 16"/></svg>';
const CLICK_UNLOCK_COUNTS = {
  singleClick: 1,
  doubleClick: 2,
  tripleClick: 3,
};
const PAUSE_DURATIONS = {
  untilClickedAgain: null,
  fiveMinutes: 5 * 60 * 1000,
  fifteenMinutes: 15 * 60 * 1000,
  untilNextFocusLoss: null,
};
const BLUR_INTENSITIES = {
  subtle: "blur(7px) saturate(0.85)",
  normal: "blur(12px) saturate(0.75)",
  strong: "blur(20px) saturate(0.6) brightness(0.88)",
};

let cleanup = null;
let cleanupUnlockHandler = null;
let extensionSettings = null;
let fallbackUnlockOptions = {};
let fallbackPauseDuration = DEFAULT_PAUSE_DURATION;
let fallbackBlurIntensity = DEFAULT_BLUR_INTENSITY;
let isLoaded = false;
let isBlurPaused = false;
let currentPauseDuration = DEFAULT_PAUSE_DURATION;
let currentBlurIntensity = DEFAULT_BLUR_INTENSITY;
let pauseTimer = null;
let topbarObserver = null;
let pauseButton = null;
let currentUnlockOptions = {
  unlockMode: DEFAULT_UNLOCK_MODE,
  unlockKey: DEFAULT_UNLOCK_KEY,
};

const css = `
html.${CLASS_LOCKED} body {
  overflow: hidden;
}

html.${CLASS_LOCKED} body > *:not(#${OVERLAY_ID}) {
  filter: var(--roam-privacy-blur-filter, ${BLUR_INTENSITIES.normal});
  transition: filter 120ms ease-out;
  pointer-events: none !important;
  user-select: none !important;
}

${ROAM_APP_SELECTORS.map((selector) => `html.${CLASS_LOCKED} ${selector}`).join(",\n")} {
  filter: var(--roam-privacy-blur-filter, ${BLUR_INTENSITIES.normal});
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

html.${CLASS_LOCKED} #${PAUSE_BUTTON_ID} {
  filter: none !important;
  pointer-events: auto !important;
}

#${PAUSE_BUTTON_ID} {
  -webkit-appearance: none !important;
  align-items: center;
  appearance: none !important;
  background: transparent !important;
  border: 0 !important;
  border-radius: 4px !important;
  box-shadow: none !important;
  color: currentColor !important;
  cursor: pointer !important;
  display: inline-flex;
  flex: 0 0 auto;
  height: 30px !important;
  justify-content: center;
  line-height: 1 !important;
  margin: 0 2px !important;
  max-width: 30px !important;
  min-height: 30px !important;
  min-width: 30px !important;
  outline: none !important;
  padding: 0 !important;
  position: relative !important;
  width: 30px !important;
  z-index: 2147483647 !important;
}

#${PAUSE_BUTTON_ID} svg {
  display: block;
  height: 18px;
  pointer-events: none;
  width: 18px;
}

#${PAUSE_BUTTON_ID}:hover {
  background: rgba(115, 134, 156, 0.12) !important;
}

#${PAUSE_BUTTON_ID}[aria-pressed="true"] {
  background: rgba(218, 130, 35, 0.14) !important;
  color: #9a520d !important;
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
  if (isBlurPaused) {
    if (readPauseDuration() === "untilNextFocusLoss") {
      setBlurPaused(false);
    }

    return;
  }

  document.documentElement.classList.add(CLASS_LOCKED);
}

function unlock() {
  document.documentElement.classList.remove(CLASS_LOCKED);
}

function isLocked() {
  return document.documentElement.classList.contains(CLASS_LOCKED);
}

function normalizePauseDuration(value) {
  return Object.prototype.hasOwnProperty.call(PAUSE_DURATIONS, value)
    ? value
    : DEFAULT_PAUSE_DURATION;
}

function normalizeBlurIntensity(value) {
  return Object.prototype.hasOwnProperty.call(BLUR_INTENSITIES, value)
    ? value
    : DEFAULT_BLUR_INTENSITY;
}

function applyBlurIntensity(blurIntensity) {
  currentBlurIntensity = normalizeBlurIntensity(blurIntensity);
  document.documentElement.style.setProperty(
    "--roam-privacy-blur-filter",
    BLUR_INTENSITIES[currentBlurIntensity],
  );
}

function readPauseDuration() {
  return currentPauseDuration;
}

function resetPauseTimer() {
  if (pauseTimer) {
    clearTimeout(pauseTimer);
    pauseTimer = null;
  }
}

function schedulePauseTimer() {
  const duration = PAUSE_DURATIONS[readPauseDuration()];

  if (!duration) {
    return;
  }

  pauseTimer = window.setTimeout(() => {
    setBlurPaused(false);
  }, duration);
}

function updatePauseButton() {
  if (!pauseButton) {
    return;
  }

  const pausedState = String(isBlurPaused);
  if (pauseButton.dataset.paused === pausedState) {
    return;
  }

  pauseButton.dataset.paused = pausedState;
  pauseButton.setAttribute("aria-pressed", pausedState);
  pauseButton.setAttribute(
    "aria-label",
    isBlurPaused ? "Resume privacy blur" : "Pause privacy blur",
  );
  pauseButton.title = isBlurPaused
    ? "Privacy blur paused"
    : "Pause privacy blur";
  pauseButton.innerHTML = isBlurPaused
    ? PAUSED_BUTTON_ICON
    : ACTIVE_BUTTON_ICON;
}

function setBlurPaused(paused) {
  isBlurPaused = paused;
  window.roamPrivacyBlurPaused = isBlurPaused;

  resetPauseTimer();

  unlock();

  if (isBlurPaused) {
    schedulePauseTimer();
  }

  updatePauseButton();
}

function togglePause(event) {
  event?.preventDefault();
  event?.stopPropagation();
  setBlurPaused(!isBlurPaused);
}

function findTopbar() {
  for (const selector of ROAM_TOPBAR_SELECTORS) {
    const topbar = document.querySelector(selector);
    if (topbar) {
      return topbar;
    }
  }

  return null;
}

function ensurePauseButton() {
  const topbar = findTopbar();
  if (!topbar) {
    return false;
  }

  if (pauseButton && !document.body.contains(pauseButton)) {
    pauseButton.removeEventListener("click", togglePause, true);
    pauseButton = null;
  }

  let button = document.getElementById(PAUSE_BUTTON_ID);

  if (button && button !== pauseButton) {
    button.remove();
    button = null;
  }

  if (!button) {
    button = document.createElement("button");
    button.id = PAUSE_BUTTON_ID;
    button.type = "button";
    button.addEventListener("click", togglePause, true);
  }

  if (button.parentNode !== topbar) {
    topbar.appendChild(button);
  }

  pauseButton = button;
  updatePauseButton();
  return true;
}

function installPauseButton() {
  ensurePauseButton();

  if (topbarObserver) {
    return;
  }

  topbarObserver = new MutationObserver(() => {
    ensurePauseButton();
  });

  topbarObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function removePauseButton() {
  if (topbarObserver) {
    topbarObserver.disconnect();
    topbarObserver = null;
  }

  if (pauseButton) {
    pauseButton.removeEventListener("click", togglePause, true);
    pauseButton.remove();
    pauseButton = null;
  } else {
    document.getElementById(PAUSE_BUTTON_ID)?.remove();
  }

  isBlurPaused = false;
  window.roamPrivacyBlurPaused = false;
  resetPauseTimer();
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

function refreshPauseDuration(pauseDuration) {
  currentPauseDuration = normalizePauseDuration(pauseDuration);

  if (!isBlurPaused) {
    return;
  }

  resetPauseTimer();
  schedulePauseTimer();
}

function refreshBlurIntensity(blurIntensity) {
  applyBlurIntensity(blurIntensity);
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
      {
        id: SETTINGS.pauseDuration,
        name: "Pause duration",
        description: "Choose how long the topbar pause button keeps privacy blur disabled.",
        action: {
          type: "select",
          items: [
            "untilClickedAgain",
            "fiveMinutes",
            "fifteenMinutes",
            "untilNextFocusLoss",
          ],
          options: [
            { value: "untilClickedAgain", label: "Until clicked again" },
            { value: "fiveMinutes", label: "5 minutes" },
            { value: "fifteenMinutes", label: "15 minutes" },
            { value: "untilNextFocusLoss", label: "Until next focus loss" },
          ],
          onChange: (eventOrValue) => {
            const pauseDuration = getChangeValue(eventOrValue);
            persistSetting(SETTINGS.pauseDuration, pauseDuration);
            refreshPauseDuration(pauseDuration);
          },
        },
      },
      {
        id: SETTINGS.blurIntensity,
        name: "Blur intensity",
        description: "Choose how strongly Roam content is blurred while privacy blur is active.",
        action: {
          type: "select",
          items: ["subtle", "normal", "strong"],
          options: [
            { value: "subtle", label: "Subtle" },
            { value: "normal", label: "Normal" },
            { value: "strong", label: "Strong" },
          ],
          onChange: (eventOrValue) => {
            const blurIntensity = getChangeValue(eventOrValue);
            persistSetting(SETTINGS.blurIntensity, blurIntensity);
            refreshBlurIntensity(blurIntensity);
          },
        },
      },
    ],
  });
}

async function onload(options = {}) {
  if (cleanup) {
    cleanup();
  } else if (window[GLOBAL_CLEANUP_KEY]) {
    window[GLOBAL_CLEANUP_KEY]();
  }

  const { extensionAPI, ...manualOptions } = options;
  extensionSettings = extensionAPI?.settings || null;
  isBlurPaused = false;
  window.roamPrivacyBlurPaused = false;
  fallbackUnlockOptions = extensionSettings
    ? {}
    : normalizeUnlockOptions(manualOptions);
  fallbackPauseDuration = extensionSettings
    ? DEFAULT_PAUSE_DURATION
    : normalizePauseDuration(manualOptions.pauseDuration);
  fallbackBlurIntensity = extensionSettings
    ? DEFAULT_BLUR_INTENSITY
    : normalizeBlurIntensity(manualOptions.blurIntensity);
  currentPauseDuration = extensionSettings
    ? normalizePauseDuration(
        getStoredSetting(SETTINGS.pauseDuration, DEFAULT_PAUSE_DURATION),
      )
    : fallbackPauseDuration;
  currentBlurIntensity = extensionSettings
    ? normalizeBlurIntensity(
        getStoredSetting(SETTINGS.blurIntensity, DEFAULT_BLUR_INTENSITY),
      )
    : fallbackBlurIntensity;

  await ensureSettingDefault(SETTINGS.unlockMode, DEFAULT_UNLOCK_MODE);
  await ensureSettingDefault(SETTINGS.unlockKey, DEFAULT_UNLOCK_KEY);
  await ensureSettingDefault(SETTINGS.pauseDuration, DEFAULT_PAUSE_DURATION);
  await ensureSettingDefault(SETTINGS.blurIntensity, DEFAULT_BLUR_INTENSITY);
  createSettingsPanel(extensionAPI);

  const style = ensureStyle();
  const overlay = ensureOverlay();
  applyBlurIntensity(currentBlurIntensity);
  isLoaded = true;
  registerUnlockHandler(overlay, readUnlockOptions());
  installPauseButton();

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
    fallbackPauseDuration = DEFAULT_PAUSE_DURATION;
    fallbackBlurIntensity = DEFAULT_BLUR_INTENSITY;
    currentPauseDuration = DEFAULT_PAUSE_DURATION;
    currentBlurIntensity = DEFAULT_BLUR_INTENSITY;
    isLoaded = false;
    resetPauseTimer();
    removePauseButton();
    document.documentElement.style.removeProperty("--roam-privacy-blur-filter");

    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }

    if (style.parentNode) {
      style.parentNode.removeChild(style);
    }

    if (window[GLOBAL_CLEANUP_KEY] === cleanup) {
      delete window[GLOBAL_CLEANUP_KEY];
    }

    cleanup = null;
  };

  window[GLOBAL_CLEANUP_KEY] = cleanup;
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
