import {createAdapterRegistry} from '../session/session.mjs';
import {createProviderIntegration, providerTroubleshooting} from '../providers/integration.mjs';
import {createEmulatorIntegration, emulatorTroubleshooting} from '../emulation/integration.mjs';
import {evaluateCatalogCompatibility} from '../compatibility/harness.mjs';

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

export function resolveLaunchPlan(entry, {allowedModes, preferEmbedded = false, providerProfile = {}} = {}) {
  assertEntry(entry);
  const integration = entry.backendType === 'provider' ? createProviderIntegration(entry, {profile: providerProfile, report: providerProfile.report}) : createEmulatorIntegration(entry, {preference: providerProfile.emulationPreference, renderer: providerProfile.renderer, report: providerProfile.report, adapterRegistry: providerProfile.adapterRegistry, allowUnsignedAdapters: providerProfile.allowUnsignedAdapters === true, platform: providerProfile.platform});
  const compatibility = evaluateCatalogCompatibility(entry, providerProfile.report || {});
  const issues = entry.backendType === 'provider' ? providerTroubleshooting(integration) : emulatorTroubleshooting(integration);
  const modes = Array.isArray(allowedModes) ? allowedModes : integration?.mode ? [integration.mode, ...(entry.integrationModes || [])] : entry.integrationModes || [entry.launchMode];
  const plans = entry.backendType === 'provider' ? PROVIDER_MODE_PLANS : EMULATOR_MODE_PLANS;
  const orderedModes = preferEmbedded ? [...modes].sort(mode => mode === 'official-embed' ? -1 : 0) : modes;
  const selectedMode = orderedModes.find(mode => plans[mode]);
  if (!selectedMode) return {backendId: entry.id, status: 'unsupported', action: 'show-support-error', reason: 'No supported integration mode is available in the current shell', availableModes: [...modes], readiness: Object.freeze({status: compatibility.status, reason: compatibility.reason, nextAction: 'show-support-error', issues})};
  const plan = plans[selectedMode];
  const nextAction = compatibility.status === 'native-adapter-required' ? 'choose-runtime' : compatibility.status === 'browser-capability-missing' ? 'run-diagnostics' : compatibility.status === 'configuration-required' ? plan.action === 'configure-host' ? 'configure-host' : 'open-service' : plan.action;
  return Object.freeze({backendId: entry.id, status: 'ready', mode: selectedMode, ...plan, url: plan.action === 'open-url' || plan.action === 'embed-url' || plan.action === 'configure-api' ? entry.url : undefined, requirements: Object.freeze([...(entry.requirements || [])]), capabilities: Object.freeze([...(entry.capabilities || [])]), integration, readiness: Object.freeze({status: compatibility.status, reason: compatibility.reason, missingCapabilities: compatibility.missingCapabilities, configuration: compatibility.configuration, nextAction, issues})});
}

export function createCatalogAdapterRegistry(entries, options = {}) {
  if (!Array.isArray(entries)) throw new TypeError('entries must be an array');
  return createAdapterRegistry(entries.map(entry => ({id: entry.id, backendId: entry.id, name: entry.name, backendType: entry.backendType, resolve: () => { const report = typeof options.report === 'function' ? options.report() : options.report; return resolveLaunchPlan(entry, {...options, report, providerProfile: {...options.providerProfiles?.[entry.id], report}}); }})));
}
