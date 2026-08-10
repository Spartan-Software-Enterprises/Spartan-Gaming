const CAPABILITY_CHECKS = Object.freeze({
  gamepad: report => report.input?.gamepad === true,
  'hardware-decode': report => Object.values(report.media?.hardwareDecode || {}).some(codec => codec.powerEfficient === true),
  webrtc: report => report.transports?.webrtc === true,
  webgpu: report => report.graphics?.webgpuAdapter === true,
  fullscreen: report => report.graphics?.webgl === true || report.graphics?.webgpu === true,
});
const CONFIGURATION_REQUIREMENTS = new Set(['provider-account', 'supported-game-library', 'subscription', 'steam-account', 'user-owned-host', 'secure-pairing', 'host-agent', 'explicit-pairing', 'supported-region', 'remote-features-enabled', 'user-owned-xbox', 'user-owned-console']);

function required(value, name) { if (!value || typeof value !== 'object') throw new TypeError(`${name} is required`); }

export function evaluateCatalogCompatibility(entry, report = {}) {
  required(entry, 'entry'); const missingCapabilities = [...new Set((entry.capabilities || []).filter(capability => CAPABILITY_CHECKS[capability] && !CAPABILITY_CHECKS[capability](report)))]; const configuration = [...new Set((entry.requirements || []).filter(requirement => CONFIGURATION_REQUIREMENTS.has(requirement)))];
  let status = 'ready'; let reason = 'Browser capabilities are available for this integration path.';
  if (entry.backendType === 'emulator' && !['browser-or-native', 'native-or-wasm-candidate'].includes(entry.mode)) { status = 'native-adapter-required'; reason = 'This runtime requires a user-installed native emulator adapter.'; }
  else if (missingCapabilities.length) { status = 'browser-capability-missing'; reason = 'One or more browser capabilities are not available.'; }
  else if (configuration.length) { status = 'configuration-required'; reason = 'Account, host, subscription, or pairing setup is required.'; }
  return Object.freeze({backendId: entry.id, status, reason, missingCapabilities: Object.freeze(missingCapabilities), configuration: Object.freeze(configuration)});
}

export function evaluateCatalog(entries, report = {}) { required(entries, 'entries'); const results = entries.map(entry => evaluateCatalogCompatibility(entry, report)); return Object.freeze({results: Object.freeze(results), get(id) { return results.find(result => result.backendId === id); }, counts: Object.freeze(results.reduce((counts, result) => ({...counts, [result.status]: (counts[result.status] || 0) + 1}), {}))}); }
