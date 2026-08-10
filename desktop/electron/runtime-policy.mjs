/** Normalize settings that can be applied to the Electron renderer at runtime. */
export function normalizeElectronRuntimePolicy(settings = {}) {
  return Object.freeze({backgroundThrottling: settings?.backgroundThrottling !== false});
}
