import {createAdapterRegistry} from '../session/session.mjs';

const PROVIDER_MODE_PLANS = Object.freeze({
  'browser-first': {kind: 'web', action: 'open-url', external: true},
  'official-launch': {kind: 'web', action: 'open-url', external: true},
  'official-embed': {kind: 'web', action: 'embed-url', external: false},
  'official-api': {kind: 'api', action: 'configure-api', external: false},
  'user-owned-host': {kind: 'remote', action: 'configure-host', external: false},
  'self-hosted': {kind: 'remote', action: 'configure-host', external: false},
});

const EMULATOR_MODE_PLANS = Object.freeze({
  native: {kind: 'native', action: 'configure-native-adapter', external: false},
  'browser-or-native': {kind: 'browser-or-native', action: 'choose-runtime', external: false},
  'native-or-wasm-candidate': {kind: 'native-or-wasm', action: 'choose-runtime', external: false},
  'native-reference': {kind: 'native', action: 'configure-native-adapter', external: false},
});

function assertEntry(entry) { if (!entry?.id || !entry.backendType) throw new TypeError('A normalized catalog entry is required'); }

export function resolveLaunchPlan(entry, {allowedModes, preferEmbedded = false} = {}) {
  assertEntry(entry);
  const modes = Array.isArray(allowedModes) ? allowedModes : entry.integrationModes || [entry.launchMode];
  const plans = entry.backendType === 'provider' ? PROVIDER_MODE_PLANS : EMULATOR_MODE_PLANS;
  const orderedModes = preferEmbedded ? [...modes].sort(mode => mode === 'official-embed' ? -1 : 0) : modes;
  const selectedMode = orderedModes.find(mode => plans[mode]);
  if (!selectedMode) return {backendId: entry.id, status: 'unsupported', action: 'show-support-error', reason: 'No supported integration mode is available in the current shell', availableModes: [...modes]};
  const plan = plans[selectedMode];
  return Object.freeze({backendId: entry.id, status: 'ready', mode: selectedMode, ...plan, url: plan.action === 'open-url' || plan.action === 'embed-url' ? entry.url : undefined, requirements: Object.freeze([...(entry.requirements || [])]), capabilities: Object.freeze([...(entry.capabilities || [])])});
}

export function createCatalogAdapterRegistry(entries, options = {}) {
  if (!Array.isArray(entries)) throw new TypeError('entries must be an array');
  return createAdapterRegistry(entries.map(entry => ({id: entry.id, backendId: entry.id, name: entry.name, backendType: entry.backendType, resolve: () => resolveLaunchPlan(entry, options)})));
}
