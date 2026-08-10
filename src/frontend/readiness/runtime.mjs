import {evaluateCatalogCompatibility} from '../compatibility/harness.mjs';
import {createHostPreflight} from '../host/readiness.mjs';

const HOST_REQUIREMENTS = new Set(['host-agent', 'user-owned-host', 'secure-pairing', 'explicit-pairing']);

function freezeLayer(layer) { return Object.freeze({...layer}); }

function needsHostPreflight(entry) {
  return (entry?.requirements || []).some(requirement => HOST_REQUIREMENTS.has(requirement)) ||
    (entry?.integrationModes || []).some(mode => mode === 'self-hosted' || mode === 'user-owned-host');
}

function chooseStatus(catalog, host, adapter) {
  if (catalog.status === 'browser-capability-missing' || catalog.status === 'native-adapter-required') return catalog.status;
  if (adapter?.status === 'blocked') return 'adapter-trust-required';
  if (adapter?.status === 'unavailable') return 'adapter-unavailable';
  if (host && host.status !== 'ready') return 'host-not-ready';
  if (catalog.status === 'configuration-required') return catalog.status;
  return 'ready';
}

function nextAction(status, entry) {
  if (status === 'browser-capability-missing') return 'run-diagnostics';
  if (status === 'native-adapter-required' || status === 'adapter-trust-required' || status === 'adapter-unavailable') return 'choose-runtime';
  if (status === 'host-not-ready') return 'configure-host';
  if (status === 'configuration-required') return entry?.backendType === 'provider' ? 'open-service' : 'configure-runtime';
  return 'launch';
}

/** Combine browser, native-adapter, and self-hosted preflight evidence. */
export function createRuntimeReadiness({entry, report = {}, hostCapabilities = null, adapter = null, clientTransports} = {}) {
  if (!entry?.id || !entry.backendType) throw new TypeError('A catalog entry is required');
  const catalog = evaluateCatalogCompatibility(entry, report);
  const host = hostCapabilities && needsHostPreflight(entry) ? createHostPreflight({capabilities: hostCapabilities, clientTransports}) : null;
  const status = chooseStatus(catalog, host, adapter);
  const blocking = [
    ...catalog.missingCapabilities.map(key => `browser:${key}`),
    ...catalog.configuration.map(key => `configuration:${key}`),
    ...(host?.blocking || []).map(key => `host:${key}`),
    ...(adapter?.status === 'blocked' ? ['adapter:trust'] : []),
    ...(adapter?.status === 'unavailable' ? ['adapter:unavailable'] : []),
  ];
  return Object.freeze({
    backendId: entry.id,
    status,
    reason: status === 'host-not-ready' ? 'The paired host is not ready to publish a compatible session.' :
      status === 'adapter-trust-required' ? 'A verified native adapter is required before launch.' :
      status === 'adapter-unavailable' ? 'A compatible native adapter is not installed for this platform.' : catalog.reason,
    nextAction: nextAction(status, entry),
    missingCapabilities: catalog.missingCapabilities,
    configuration: catalog.configuration,
    blocking: Object.freeze([...new Set(blocking)]),
    layers: Object.freeze({catalog: freezeLayer(catalog), host, adapter}),
  });
}
