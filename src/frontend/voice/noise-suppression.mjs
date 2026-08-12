
// src/frontend/voice/noise-suppression.mjs
const NOISE_SUPPRESSION_PROFILES = Object.freeze(['off', 'basic', 'aggressive', 'ml']);
const PLATFORM_CAPABILITIES = Object.freeze({
  chromium: Object.freeze(['off', 'basic', 'aggressive']),
  electron: Object.freeze(['off', 'basic', 'aggressive']),
  android: Object.freeze(['off', 'basic']),
  firefox: Object.freeze(['off', 'basic']),
  unknown: Object.freeze(['off', 'basic']),
});

export function normalizeNoiseSuppressionPreference(raw) {
  return NOISE_SUPPRESSION_PROFILES.includes(raw) ? raw : 'basic';
}

export function resolveEffectiveNoiseSuppression(requested, platform) {
  const requestedProfile = normalizeNoiseSuppressionPreference(requested);
  const supported = PLATFORM_CAPABILITIES[platform] ?? PLATFORM_CAPABILITIES.unknown;
  if (supported.includes(requestedProfile)) return { requested: requestedProfile, effective: requestedProfile, downgraded: false, reason: 'ok' };
  const order = ['ml', 'aggressive', 'basic', 'off'];
  const requestedIndex = order.indexOf(requestedProfile);
  let effective = 'off';
  for (let i = requestedIndex; i < order.length; i++) {
    if (supported.includes(order[i])) { effective = order[i]; break; }
  }
  return { requested: requestedProfile, effective, downgraded: effective !== requestedProfile, reason: effective === requestedProfile ? 'ok' : 'platform-capability-limited' };
}

export function buildNoiseSuppressionConstraints(effectiveProfile) {
  const profile = normalizeNoiseSuppressionPreference(effectiveProfile);
  switch (profile) {
    case 'off': return { noiseSuppression: false, echoCancellation: false, autoGainControl: false };
    case 'basic': return { noiseSuppression: true, echoCancellation: false, autoGainControl: false };
    case 'aggressive': return { noiseSuppression: true, echoCancellation: true, autoGainControl: false };
    case 'ml': return { noiseSuppression: true, echoCancellation: true, autoGainControl: true };
    default: return { noiseSuppression: true, echoCancellation: false, autoGainControl: false };
  }
}
