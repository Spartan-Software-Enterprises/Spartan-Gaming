import { calculateBandwidthUsage, createCloudGameDeepLink, listCloudStreamPresets } from './cloud-features.mjs';

function list(value) {
  return Object.freeze(Array.isArray(value) ? [...value] : []);
}

export function createProviderDetailsModel(entry, plan) {
  if (!entry || entry.backendType !== 'provider')
    throw new TypeError('A provider entry is required');
  if (!plan || plan.backendId !== entry.id)
    throw new TypeError('A matching provider launch plan is required');
  const integration = plan.integration || {};
  const readiness = plan.readiness || {};
  const bitrateKbps =
    integration.quality === 'prefer-latency'
      ? 15000
      : integration.quality === 'prefer-quality'
        ? 25000
        : 12000;
  return Object.freeze({
    providerId: entry.id,
    name: entry.name,
    kind: entry.kind,
    supportLevel: entry.supportLevel || 'Community',
    status: plan.status,
    mode: plan.mode || null,
    action: plan.action || 'show-support-error',
    url: plan.url || entry.url,
    requirements: list(plan.requirements || entry.requirements),
    capabilities: list(plan.capabilities || entry.capabilities),
    surfaces: list(integration.surfaces),
    quality: integration.quality || 'balanced',
    regionLabel: integration.regionLabel || 'Automatic',
    controllerProfile: integration.controllerProfile || 'Not applicable',
    autoFullscreen: integration.autoFullscreen !== false,
    notes: list(integration.notes),
    readinessStatus: readiness.status || 'unknown',
    readinessReason: readiness.reason || 'Readiness evidence is not available yet.',
    missingCapabilities: list(readiness.missingCapabilities),
    blocking: list(readiness.blocking),
    troubleshooting: list((readiness.issues || []).map((issue) => issue.message).filter(Boolean)),
    streamPresets: listCloudStreamPresets(),
    bandwidthEstimate: calculateBandwidthUsage({ bitrateKbps, durationMinutes: 60 }),
    deepLinkSupported: Boolean(createCloudGameDeepLink(entry.id, 'test-game')),
  });
}
