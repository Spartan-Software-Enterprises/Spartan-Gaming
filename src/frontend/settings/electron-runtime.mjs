export const GLOBAL_SHORTCUT_OPTIONS = Object.freeze([
  'Disabled',
  'CommandOrControl+Shift+G',
  'CommandOrControl+Alt+G',
]);

const GLOBAL_SHORTCUTS = new Set(GLOBAL_SHORTCUT_OPTIONS.slice(1));

export function normalizeGlobalShortcut(value) {
  return GLOBAL_SHORTCUTS.has(value) ? value : null;
}

export function describeElectronRuntimeResult(result) {
  if (result?.startupPolicy?.requiresRestart)
    return 'Saved locally; restart Spartan Gaming to apply hardware acceleration changes.';
  const shortcut = result?.globalShortcutStatus;
  if (shortcut?.status === 'unavailable')
    return 'Saved locally; desktop shortcut is unavailable or already in use.';
  if (shortcut?.status === 'registered') return `Saved locally; ${shortcut.accelerator} is active.`;
  return 'Saved locally';
}

/** Convert persisted settings into the bounded Electron runtime policy payload. */
export function resolveElectronRuntimeSettings(settings = {}) {
  return Object.freeze({
    hardwareAcceleration: settings['performance.hardwareAcceleration'] !== false,
    backgroundApps: settings['general.backgroundApps'] === true,
    globalShortcut: settings['general.globalShortcut'],
    backgroundThrottling: settings['performance.backgroundThrottling'] !== false,
    powerMode: settings['performance.powerMode'],
    doNotTrack: settings['privacy.doNotTrack'] === true,
    blockThirdPartyCookies: settings['privacy.blockThirdPartyCookies'] === true,
    permissionPrompts: settings['privacy.permissionPrompts'],
  });
}
