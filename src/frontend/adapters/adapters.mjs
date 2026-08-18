import { createAdapterRegistry } from '../session/session.mjs';
import { createProviderIntegration, providerTroubleshooting } from '../providers/integration.mjs';
import { createNativeClientLaunchPlan } from '../providers/native-client.mjs';
import { createEmulatorIntegration, emulatorTroubleshooting } from '../emulation/integration.mjs';
import { evaluateCatalogCompatibility } from '../compatibility/harness.mjs';
import { createRuntimeReadiness } from '../readiness/runtime.mjs';

const PROVIDER_MODE_PLANS = Object.freeze({
  'browser-first': { kind: 'web', action: 'open-url', external: true },
  'provider-launch': { kind: 'web', action: 'open-url', external: true },
  'provider-embed': { kind: 'web', action: 'embed-url', external: false },
  'provider-api': { kind: 'api', action: 'configure-api', external: false },
  'native-client': { kind: 'native', action: 'open-native-client', external: false },
  'user-owned-host': { kind: 'remote', action: 'configure-host', external: false },
  'self-hosted': { kind: 'remote', action: 'configure-host', external: false },
});

const EMULATOR_MODE_PLANS = Object.freeze({
  native: { kind: 'native', action: 'configure-native-adapter', external: false },
  'browser-or-native': { kind: 'browser-or-native', action: 'choose-runtime', external: false },
  'native-or-wasm-candidate': { kind: 'native-or-wasm', action: 'choose-runtime', external: false },
  'native-reference': { kind: 'native', action: 'configure-native-adapter', external: false },
});

const GAME_MODE_PLANS = Object.freeze({
  'browser-first': { kind: 'web-game', action: 'open-url', external: true },
});

function assertEntry(entry) {
  if (!entry?.id || !entry.backendType)
    throw new TypeError('A normalized catalog entry is required');
}

export function resolveLaunchPlan(
  entry,
  { allowedModes, preferEmbedded = false, providerProfile = {} } = {},
) {
  assertEntry(entry);
  const integration =
    entry.backendType === 'provider'
      ? createProviderIntegration(entry, {
          profile: providerProfile,
          report: providerProfile.report,
        })
      : entry.backendType === 'emulator'
        ? createEmulatorIntegration(entry, {
            preference: providerProfile.emulationPreference,
            renderer: providerProfile.renderer,
            report: providerProfile.report,
            adapterRegistry: providerProfile.adapterRegistry,
            allowUnsignedAdapters: providerProfile.allowUnsignedAdapters === true,
            platform: providerProfile.platform,
          })
        : Object.freeze({
            mode: entry.integrationModes?.[0] || 'browser-first',
            quality: 'browser-native',
            regionLabel: 'Global',
            controllerProfile: entry.capabilities?.includes('gamepad') ? 'Auto-detect' : null,
            surfaces: Object.freeze(['Browser game']),
            requirements: Object.freeze([...(entry.requirements || [])]),
            notes: Object.freeze([
              'The official game surface opens in a separate web context; Spartan Gaming does not mirror or redistribute game content.',
            ]),
          });
  const compatibility = evaluateCatalogCompatibility(entry, providerProfile.report || {});
  const issues =
    entry.backendType === 'provider'
      ? providerTroubleshooting(integration)
      : entry.backendType === 'emulator'
        ? emulatorTroubleshooting(integration)
        : Object.freeze([]);
  const runtimeReadiness = createRuntimeReadiness({
    entry,
    report: providerProfile.report || {},
    hostCapabilities: providerProfile.hostCapabilities,
    adapter: integration.adapter,
    clientTransports: providerProfile.clientTransports,
  });
  const modes = Array.isArray(allowedModes)
    ? allowedModes
    : integration?.mode
      ? [integration.mode, ...(entry.integrationModes || [])]
      : entry.integrationModes || [entry.launchMode];
  const plans =
    entry.backendType === 'provider'
      ? PROVIDER_MODE_PLANS
      : entry.backendType === 'emulator'
        ? EMULATOR_MODE_PLANS
        : GAME_MODE_PLANS;
  const orderedModes = preferEmbedded
    ? [...modes].sort((mode) => (mode === 'provider-embed' ? -1 : 0))
    : modes;
  const selectedMode = orderedModes.find(
    (mode) => plans[mode] && (mode !== 'provider-embed' || integration.embedUrl),
  );
  if (!selectedMode)
    return {
      backendId: entry.id,
      status: 'unsupported',
      action: 'show-support-error',
      reason: 'No supported integration mode is available in the current shell',
      availableModes: [...modes],
      readiness: Object.freeze({
        status: compatibility.status,
        reason: compatibility.reason,
        nextAction: 'show-support-error',
        issues,
      }),
    };
  const plan = plans[selectedMode];
  const nextAction =
    runtimeReadiness.status === 'native-adapter-required'
      ? 'choose-runtime'
      : runtimeReadiness.status === 'browser-capability-missing'
        ? 'run-diagnostics'
        : runtimeReadiness.status === 'host-not-ready' ||
            (runtimeReadiness.status === 'configuration-required' &&
              plan.action === 'configure-host')
          ? 'configure-host'
          : runtimeReadiness.status === 'configuration-required'
            ? 'open-service'
            : plan.action;
  const nativeClient =
    selectedMode === 'native-client'
      ? { providerId: entry.id, platform: providerProfile.platform }
      : integration.nativeClient;
  const nativeLaunch = nativeClient
    ? createNativeClientLaunchPlan({
        providerId: entry.id,
        platform: nativeClient.platform,
        discovery: providerProfile.clientDiscovery,
      })
    : null;
  return Object.freeze({
    backendId: entry.id,
    status: 'ready',
    mode: selectedMode,
    ...plan,
    url:
      plan.action === 'embed-url'
        ? integration.embedUrl
        : plan.action === 'open-url' || plan.action === 'configure-api'
          ? entry.url
          : undefined,
    nativeLaunch,
    requirements: Object.freeze([...(entry.requirements || [])]),
    capabilities: Object.freeze([...(entry.capabilities || [])]),
    integration,
    readiness: Object.freeze({ ...runtimeReadiness, nextAction, issues }),
  });
}

export function createCatalogAdapterRegistry(entries, options = {}) {
  if (!Array.isArray(entries)) throw new TypeError('entries must be an array');
  return createAdapterRegistry(
    entries.map((entry) => ({
      id: entry.id,
      backendId: entry.id,
      name: entry.name,
      backendType: entry.backendType,
      resolve: () => {
        const report = typeof options.report === 'function' ? options.report() : options.report;
        return resolveLaunchPlan(entry, {
          ...options,
          report,
          providerProfile: { ...options.providerProfiles?.[entry.id], report },
        });
      },
    })),
  );
}
