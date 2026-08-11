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
    return 'Saved locally; restart Spartan Gaming to apply performance changes.';
  const shortcut = result?.globalShortcutStatus;
  if (shortcut?.status === 'unavailable')
    return 'Saved locally; desktop shortcut is unavailable or already in use.';
  if (shortcut?.status === 'registered') return `Saved locally; ${shortcut.accelerator} is active.`;
  return 'Saved locally';
}

export function describeElectronUpdateStatus(result) {
  if (result?.status === 'development-build')
    return 'Update checks run only from a packaged Spartan Gaming application.';
  if (result?.status === 'disabled') return 'Automatic update checks are disabled.';
  if (result?.status === 'checking') return 'Checking the selected release channel…';
  if (result?.status === 'update-available')
    return result.version
      ? `Spartan Gaming ${result.version} is available.`
      : 'An update is available.';
  if (result?.status === 'downloading')
    return Number.isFinite(result.percent)
      ? `Downloading verified update… ${result.percent}%`
      : 'Downloading verified update…';
  if (result?.status === 'downloaded')
    return result.version
      ? `Spartan Gaming ${result.version} is ready to install.`
      : 'The update is ready to install.';
  if (result?.status === 'up-to-date') return 'Spartan Gaming is up to date.';
  if (result?.status === 'unavailable')
    return 'The selected signed release channel is currently unavailable.';
  return 'Update status is idle.';
}

/** Convert persisted settings into the bounded Electron runtime policy payload. */
export function resolveElectronRuntimeSettings(settings = {}) {
  return Object.freeze({
    developerMode: settings['advanced.developerMode'] === true,
    hardwareAcceleration: settings['performance.hardwareAcceleration'] !== false,
    gpuPreference: ['Automatic', 'Power saving GPU', 'High performance GPU'].includes(
      settings['performance.gpuPreference'],
    )
      ? settings['performance.gpuPreference']
      : 'Automatic',
    processModel: ['Default', 'Maximum isolation', 'Low memory'].includes(
      settings['performance.processModel'],
    )
      ? settings['performance.processModel']
      : 'Default',
    crashReports: settings['performance.crashReports'] === true,
    verboseLogs: settings['advanced.verboseLogs'] === true,
    logRetention: settings['advanced.logRetention'],
    backgroundApps: settings['general.backgroundApps'] === true,
    globalShortcut: settings['general.globalShortcut'],
    backgroundThrottling: settings['performance.backgroundThrottling'] !== false,
    powerMode: settings['performance.powerMode'],
    doNotTrack: settings['privacy.doNotTrack'] === true,
    blockThirdPartyCookies: settings['privacy.blockThirdPartyCookies'] === true,
    permissionPrompts: settings['privacy.permissionPrompts'],
    updateChannel: settings['updates.channel'],
    autoUpdate: settings['updates.autoUpdate'] !== false,
    notifyRestart: settings['updates.notifyRestart'] !== false,
  });
}
