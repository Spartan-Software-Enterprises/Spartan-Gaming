import {evaluateAdapterManifest, normalizeAdapterManifest, verifyAdapterSignature} from '../adapters/manifest-registry.mjs';

const MAX_MODULE_BYTES = 50 * 1024 * 1024;

function required(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}

function bytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  throw new TypeError('adapter module bytes must be an ArrayBuffer or Uint8Array');
}

function base64Url(value) {
  const data = bytes(value);
  let binary = '';
  for (const item of data) binary += String.fromCharCode(item);
  const encoded = typeof btoa === 'function' ? btoa(binary) : Buffer.from(data).toString('base64');
  return encoded.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function canonicalPayload(manifest) {
  return JSON.stringify({
    id: manifest.id,
    version: manifest.version,
    kind: manifest.kind,
    platforms: manifest.platforms,
    capabilities: manifest.capabilities,
    license: manifest.license,
    integrity: manifest.integrity,
    entrypoint: manifest.entrypoint,
  });
}

function moduleUrl(value) {
  const url = new URL(required(value, 'adapter.entrypoint'));
  if (url.protocol !== 'https:') throw new TypeError('browser adapter entrypoints must use HTTPS');
  if (url.username || url.password) throw new TypeError('browser adapter entrypoints cannot contain credentials');
  return url.href;
}

function responseBytes(response) {
  if (!response || typeof response.arrayBuffer !== 'function') throw new Error('browser adapter response did not provide bytes');
  const declared = Number(response.headers?.get?.('content-length') || 0);
  if (declared > MAX_MODULE_BYTES) throw new Error(`browser adapter exceeds the ${MAX_MODULE_BYTES} byte limit`);
  return response.arrayBuffer().then(value => {
    const result = bytes(value);
    if (result.byteLength > MAX_MODULE_BYTES) throw new Error(`browser adapter exceeds the ${MAX_MODULE_BYTES} byte limit`);
    return result;
  });
}

async function importBrowserModule(moduleBytes, {BlobImpl = globalThis.Blob, URLImpl = globalThis.URL, importModule} = {}) {
  if (typeof importModule === 'function') return importModule(moduleBytes);
  if (typeof BlobImpl !== 'function' || typeof URLImpl?.createObjectURL !== 'function') throw new Error('browser module import is unavailable');
  const blob = new BlobImpl([moduleBytes], {type: 'text/javascript'});
  const url = URLImpl.createObjectURL(blob);
  try {
    return await import(/* webpackIgnore: true */ url);
  } finally {
    URLImpl.revokeObjectURL?.(url);
  }
}

function adapterFromModule(module, id) {
  const adapter = module?.adapter || module?.default?.adapter || module?.default;
  if (!adapter || typeof adapter !== 'object') throw new Error('browser adapter module did not export an adapter');
  if (adapter.id !== id) throw new Error(`browser adapter id ${adapter.id || '<missing>'} does not match manifest ${id}`);
  if (typeof adapter.load !== 'function' || typeof adapter.start !== 'function' || typeof adapter.stop !== 'function') throw new Error(`browser adapter ${id} must provide load(), start(), and stop()`);
  return adapter;
}

/**
 * Fetch and verify a separately distributed browser-WASM/libretro adapter.
 * The manifest signature covers the canonical descriptor, while integrity
 * covers the fetched JavaScript/WASM bridge module. No storage or filesystem
 * side effects occur; callers explicitly register the result for this session.
 */
export async function loadVerifiedBrowserEmulatorAdapter({manifest, platform = 'browser', trustedSigners = {}, consent = false, fetchImpl = globalThis.fetch, subtle = globalThis.crypto?.subtle, importModule, BlobImpl = globalThis.Blob, URLImpl = globalThis.URL} = {}) {
  if (consent !== true) throw new Error('explicit user consent is required before loading a browser adapter');
  if (typeof fetchImpl !== 'function') throw new Error('browser adapter loading requires fetch');
  const normalized = normalizeAdapterManifest(manifest);
  const readiness = evaluateAdapterManifest(normalized, {platform, kind: 'emulator', allowUnsigned: false});
  if (readiness.status !== 'ready') throw new Error(readiness.reason || 'browser adapter manifest is not ready');
  const entrypoint = moduleUrl(normalized.entrypoint);
  const signer = normalized.signature?.signer;
  const publicKeyJwk = trustedSigners?.[signer];
  if (!publicKeyJwk) throw new Error(`no trusted public key is configured for adapter signer ${signer}`);
  const response = await fetchImpl(entrypoint, {method: 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store'});
  if (!response?.ok) throw new Error(`browser adapter returned HTTP ${Number(response?.status) || 0}`);
  const moduleBytes = await responseBytes(response);
  if (!subtle || typeof subtle.digest !== 'function') throw new Error('WebCrypto digest verification is unavailable');
  const digest = base64Url(await subtle.digest('SHA-256', moduleBytes));
  if (digest !== normalized.integrity.slice('sha256-'.length)) throw new Error('browser adapter integrity verification failed');
  const verified = await verifyAdapterSignature({data: canonicalPayload(normalized), signature: normalized.signature, publicKeyJwk, subtle});
  if (!verified) throw new Error('browser adapter signature verification failed');
  const module = await importBrowserModule(moduleBytes, {BlobImpl, URLImpl, importModule});
  const adapter = adapterFromModule(module, normalized.id);
  return Object.freeze({manifest: normalized, adapter, entrypoint, integrity: `sha256-${digest}`, verified: true});
}

export {canonicalPayload};
