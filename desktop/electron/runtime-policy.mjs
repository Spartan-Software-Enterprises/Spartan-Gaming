function origin(value) { try { return new URL(String(value)).origin; } catch { return ''; } }

/** Normalize settings that can be applied to the Electron renderer at runtime. */
export function normalizeElectronRuntimePolicy(settings = {}) {
  return Object.freeze({backgroundThrottling: settings?.backgroundThrottling !== false, doNotTrack: settings?.doNotTrack === true, blockThirdPartyCookies: settings?.blockThirdPartyCookies === true});
}

export function isThirdPartyRequest({url, initiator} = {}) {
  const requestOrigin = origin(url); const initiatorOrigin = origin(initiator);
  return Boolean(requestOrigin && initiatorOrigin && requestOrigin !== initiatorOrigin);
}

/** Apply privacy headers without changing credentials, destinations, or methods. */
export function applyElectronPrivacyHeaders(headers = {}, details = {}, policy = normalizeElectronRuntimePolicy()) {
  const next = {...headers};
  if (policy.doNotTrack) {
    for (const key of Object.keys(next)) if (key.toLowerCase() === 'dnt') delete next[key];
    next.DNT = '1';
  }
  if (policy.blockThirdPartyCookies && isThirdPartyRequest(details)) {
    for (const key of Object.keys(next)) if (key.toLowerCase() === 'cookie') delete next[key];
  }
  return Object.freeze(next);
}
