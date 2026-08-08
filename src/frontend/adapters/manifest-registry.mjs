const STATUSES = new Set(['available', 'installed', 'blocked', 'unavailable']);
const TRUST = new Set(['signed', 'unsigned', 'unknown']);
const KINDS = new Set(['emulator', 'provider', 'host']);

function required(value, name) { if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`); return value.trim(); }
function list(value, name) { if (!Array.isArray(value) || !value.length || value.some(item => typeof item !== 'string' || !item.trim())) throw new TypeError(`${name} must contain non-empty strings`); return Object.freeze([...new Set(value.map(item => item.trim()))]); }

export function normalizeAdapterManifest(record) {
  const id = required(record?.id, 'adapter.id'); const version = required(record?.version, 'adapter.version'); const kind = required(record?.kind, 'adapter.kind');
  if (!KINDS.has(kind)) throw new TypeError(`unsupported adapter kind: ${kind}`);
  const status = STATUSES.has(record.status) ? record.status : 'unavailable'; const trust = TRUST.has(record.trust) ? record.trust : 'unknown';
  const platforms = list(record.platforms, 'adapter.platforms'); const capabilities = list(record.capabilities || ['streaming'], 'adapter.capabilities'); const license = required(record.license, 'adapter.license');
  const integrity = required(record.integrity, 'adapter.integrity');
  if (!/^sha256-[A-Za-z0-9_-]+$/.test(integrity)) throw new TypeError('adapter.integrity must be a sha256- encoded digest');
  let signature = null;
  if (trust === 'signed') signature = Object.freeze({algorithm: required(record.signature?.algorithm, 'adapter.signature.algorithm'), signer: required(record.signature?.signer, 'adapter.signature.signer'), value: required(record.signature?.value, 'adapter.signature.value')});
  return Object.freeze({id, version, kind, status, trust, platforms, capabilities, license, integrity, signature, entrypoint: typeof record.entrypoint === 'string' && record.entrypoint.trim() ? record.entrypoint.trim() : null});
}

export function evaluateAdapterManifest(record, {platform, kind, allowUnsigned = false} = {}) {
  const normalized = normalizeAdapterManifest(record);
  if (kind && normalized.kind !== kind) return Object.freeze({id: normalized.id, status: 'unavailable', reason: 'adapter kind does not match the requested runtime'});
  if (platform && !normalized.platforms.includes(platform) && !normalized.platforms.includes('universal')) return Object.freeze({id: normalized.id, status: 'unavailable', reason: 'adapter does not support this platform'});
  if (normalized.status === 'blocked' || normalized.status === 'unavailable') return Object.freeze({id: normalized.id, status: normalized.status, reason: 'adapter is not available for launch'});
  if (normalized.trust === 'signed') return Object.freeze({id: normalized.id, status: 'ready', trust: 'signed', version: normalized.version});
  if (normalized.trust === 'unsigned' && allowUnsigned) return Object.freeze({id: normalized.id, status: 'ready-unsigned', trust: 'unsigned', version: normalized.version});
  return Object.freeze({id: normalized.id, status: 'blocked', trust: normalized.trust, version: normalized.version, reason: 'a verified signed adapter is required; enable unsigned development adapters explicitly to override'});
}

export function createAdapterManifestRegistry({records = [], platform, trustedSigners = {}} = {}) {
  const normalized = records.map(normalizeAdapterManifest); const byId = new Map();
  for (const record of normalized) { if (byId.has(record.id)) throw new Error(`duplicate adapter manifest: ${record.id}`); byId.set(record.id, record); }
  return Object.freeze({list: () => Object.freeze([...byId.values()]), get: id => byId.get(id), resolve(id, options = {}) { const record = byId.get(id); return record ? evaluateAdapterManifest(record, {platform, ...options}) : Object.freeze({id, status: 'unavailable', reason: 'adapter manifest is not installed'}); }, trustedSigners: Object.freeze({...trustedSigners})});
}

function bytes(value) { if (value instanceof Uint8Array) return value; if (typeof value === 'string') return new TextEncoder().encode(value); throw new TypeError('signature data must be a string or Uint8Array'); }
function signatureBytes(value) { if (value instanceof Uint8Array) return value; if (typeof value !== 'string' || !value) throw new TypeError('signature must be a base64url string or Uint8Array'); const normalized = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4); const binary = typeof atob === 'function' ? atob(normalized) : Buffer.from(normalized, 'base64').toString('binary'); return Uint8Array.from(binary, character => character.charCodeAt(0)); }

export async function verifyAdapterSignature({data, signature, publicKeyJwk, subtle = globalThis.crypto?.subtle} = {}) {
  if (!subtle || typeof subtle.importKey !== 'function' || typeof subtle.verify !== 'function') throw new Error('WebCrypto signature verification is unavailable');
  if (!signature?.algorithm || !publicKeyJwk) throw new TypeError('signature algorithm and public key are required');
  const algorithm = signature.algorithm === 'ECDSA-P256-SHA256' ? {name: 'ECDSA', namedCurve: 'P-256'} : signature.algorithm === 'RSA-PSS-SHA256' ? {name: 'RSA-PSS', hash: 'SHA-256'} : null;
  if (!algorithm) throw new Error(`unsupported adapter signature algorithm: ${signature.algorithm}`);
  const key = await subtle.importKey('jwk', publicKeyJwk, algorithm, false, ['verify']);
  const verifyAlgorithm = algorithm.name === 'ECDSA' ? {name: 'ECDSA', hash: 'SHA-256'} : {name: 'RSA-PSS', saltLength: 32};
  return Boolean(await subtle.verify(verifyAlgorithm, key, signatureBytes(signature.value), bytes(data)));
}
