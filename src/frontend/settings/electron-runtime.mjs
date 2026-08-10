/** Convert persisted settings into the bounded Electron runtime policy payload. */
export function resolveElectronRuntimeSettings(settings = {}) {
  return Object.freeze({
    backgroundApps: settings['general.backgroundApps'] === true,
    backgroundThrottling: settings['performance.backgroundThrottling'] !== false,
    powerMode: settings['performance.powerMode'],
    doNotTrack: settings['privacy.doNotTrack'] === true,
    blockThirdPartyCookies: settings['privacy.blockThirdPartyCookies'] === true,
    permissionPrompts: settings['privacy.permissionPrompts'],
  });
}
