import {
  createAdapterManifestRegistry,
  createAdapterUpdatePlan,
  normalizeAdapterManifest,
} from './manifest-registry.mjs';

const BROWSER_MODES = new Set(['browser-or-native', 'native-or-wasm-candidate']);

export function detectAdapterPlatform(platform = globalThis.navigator?.platform || '') {
  const value = String(platform).toLowerCase();
  if (value.includes('win')) return 'win32';
  if (value.includes('mac') || value.includes('darwin')) return 'darwin';
  if (value.includes('linux') || value.includes('x11')) return 'linux';
  return 'browser';
}

export function readAdapterManifestBundle(value) {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  const records = Array.isArray(parsed) ? parsed : parsed?.records;
  if (!Array.isArray(records) || records.length > 200)
    throw new TypeError('adapter manifest bundle must contain up to 200 records');
  return Object.freeze(records.map(normalizeAdapterManifest));
}

export function readReleaseFeed(value) {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (parsed?.schemaVersion !== 1 || !Array.isArray(parsed.records) || parsed.records.length > 500)
    throw new TypeError('release feed must use schemaVersion 1 with up to 500 records');
  return Object.freeze(parsed.records.map(normalizeAdapterManifest));
}

export function createAdapterManagerModel({
  cores = [],
  records = [],
  feed = [],
  platform = 'browser',
  allowUnsigned = false,
} = {}) {
  if (!Array.isArray(cores) || !Array.isArray(records))
    throw new TypeError('cores and records must be arrays');
  const feedRecords = !feed
    ? []
    : Array.isArray(feed)
      ? readReleaseFeed({ schemaVersion: 1, records: feed })
      : readReleaseFeed(feed);
  const merged = [...records];
  for (const record of feedRecords) {
    const index = merged.findIndex((existing) => existing.id === record.id);
    if (index >= 0) merged[index] = record;
    else merged.push(record);
  }
  const registry = createAdapterManifestRegistry({ records: merged, platform });
  const rows = cores.map((core) => {
    const browserReady = BROWSER_MODES.has(core.mode);
    const adapter = registry.resolve(core.id, { kind: 'emulator', allowUnsigned });
    const installed = records.find((record) => record.id === core.id);
    const candidates = feedRecords.filter(
      (record) => record.id === core.id && record.kind === 'emulator',
    );
    const release = installed
      ? candidates.length
        ? createAdapterUpdatePlan({
            current: installed,
            candidates,
            platform,
            kind: 'emulator',
            allowUnsigned,
          })
        : null
      : candidates.length
        ? Object.freeze({
            id: core.id,
            status: 'install-available',
            from: null,
            to: candidates[0].version,
            adapter: candidates[0],
            readiness: {
              status: 'ready',
              id: core.id,
              trust: 'signed',
              version: candidates[0].version,
            },
          })
        : null;
    return Object.freeze({
      id: core.id,
      name: core.name,
      systems: Object.freeze([...(core.systems || [])]),
      mode: core.mode,
      license: core.license,
      browserReady,
      adapter,
      release,
      status: browserReady ? 'browser-runtime' : adapter.status,
      reason: browserReady
        ? 'Core is eligible for a browser-WASM adapter; actual adapter binaries remain separately supplied.'
        : adapter.reason,
    });
  });
  return Object.freeze({
    platform,
    allowUnsigned,
    registry,
    rows: Object.freeze(rows),
    manifests: registry.list(),
  });
}
