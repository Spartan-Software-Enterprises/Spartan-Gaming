const ADAPTERS = Object.freeze([
  Object.freeze({
    id: 'node-datachannel',
    packageName: 'node-datachannel',
    kind: 'native',
    capabilities: Object.freeze(['webrtc', 'rtp', 'data-channel']),
  }),
  Object.freeze({
    id: 'werift',
    packageName: 'werift',
    kind: 'typescript',
    capabilities: Object.freeze(['webrtc', 'rtp', 'data-channel']),
  }),
]);

function status(adapter, state, reason = '') {
  return Object.freeze({ ...adapter, state, reason });
}

export function listWebRtcAdapters() {
  return ADAPTERS;
}

export async function detectWebRtcAdapters({ loader = (packageName) => import(packageName) } = {}) {
  if (typeof loader !== 'function') throw new TypeError('loader must be a function');
  const results = await Promise.all(
    ADAPTERS.map(async (adapter) => {
      try {
        return Object.freeze({
          ...status(adapter, 'available'),
          module: await loader(adapter.packageName),
        });
      } catch (error) {
        return status(
          adapter,
          'unavailable',
          error instanceof Error ? error.message : String(error),
        );
      }
    }),
  );
  return Object.freeze(results);
}

export function selectWebRtcAdapter(adapters, preferred = []) {
  if (!Array.isArray(adapters)) throw new TypeError('adapters must be an array');
  const preference = Array.isArray(preferred) ? preferred.map(String) : [];
  return (
    adapters.find((adapter) => adapter?.state === 'available' && preference.includes(adapter.id)) ??
    adapters.find((adapter) => adapter?.state === 'available') ??
    null
  );
}

export function webRtcReadiness(adapters = []) {
  const available = adapters.filter((adapter) => adapter?.state === 'available');
  return Object.freeze({
    ready: available.length > 0,
    available: Object.freeze(available.map((adapter) => adapter.id)),
    requires: Object.freeze(available.length ? [] : ['optional-webrtc-adapter']),
  });
}
