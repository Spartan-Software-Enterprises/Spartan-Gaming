import { createAdapterManifestRegistry, normalizeAdapterManifest } from './manifest-registry.mjs';

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

export function createAdapterManagerModel({
  cores = [],
  records = [],
  platform = 'browser',
  allowUnsigned = false,
} = {}) {
  if (!Array.isArray(cores) || !Array.isArray(records))
    throw new TypeError('cores and records must be arrays');
  const registry = createAdapterManifestRegistry({ records, platform });
  const rows = cores.map((core) => {
    const browserReady = BROWSER_MODES.has(core.mode);
    const adapter = registry.resolve(core.id, { kind: 'emulator', allowUnsigned });
    return Object.freeze({
      id: core.id,
      name: core.name,
      systems: Object.freeze([...(core.systems || [])]),
      mode: core.mode,
      license: core.license,
      browserReady,
      adapter,
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
