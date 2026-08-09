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
  let artifact = null;
  if (record.artifact !== undefined && record.artifact !== null) {
    if (!record.artifact || typeof record.artifact !== 'object') throw new TypeError('adapter.artifact must be an object');
    const url = required(record.artifact.url, 'adapter.artifact.url');
    if (!/^https:\/\//i.test(url)) throw new TypeError('adapter.artifact.url must use https');
    const sizeBytes = Number(record.artifact.sizeBytes);
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > 5_000_000_000) throw new TypeError('adapter.artifact.sizeBytes must be between 1 and 5000000000');
    if (record.artifact.integrity !== integrity) throw new TypeError('adapter.artifact.integrity must match adapter.integrity');
    artifact = Object.freeze({url, sizeBytes, integrity});
  }
  let packageDescriptor = null;
  if (record.package !== undefined && record.package !== null) {
    if (kind !== 'emulator') throw new TypeError('only emulator adapters may declare a signed package');
    if (!record.package || typeof record.package !== 'object') throw new TypeError('adapter.package must be an object');
    const packageId = required(record.package.id, 'adapter.package.id'); const packageVersion = required(record.package.version, 'adapter.package.version');
    if (packageId !== id || packageVersion !== version) throw new TypeError('adapter.package must match adapter identity');
    const packagePlatform = required(record.package.platform, 'adapter.package.platform');
    if (packagePlatform !== 'universal' && !platforms.includes(packagePlatform)) throw new TypeError('adapter.package.platform must be listed in adapter.platforms');
    const format = required(record.package.format, 'adapter.package.format');
    const entrypoint = required(record.package.entrypoint, 'adapter.package.entrypoint');
    if (!Array.isArray(record.package.files) || !record.package.files.length || record.package.files.length > 100_000) throw new TypeError('adapter.package.files must contain 1-100000 entries');
    const files = record.package.files.map((file, index) => {
      if (!file || typeof file !== 'object') throw new TypeError(`adapter.package.files[${index}] must be an object`);
      const path = required(file.path, `adapter.package.files[${index}].path`);
      if (file.integrity && !/^sha256-[A-Za-z0-9_-]+$/.test(file.integrity)) throw new TypeError(`adapter.package.files[${index}].integrity must use sha256-`);
      const sizeBytes = Number(file.sizeBytes ?? 0);
      if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0 || sizeBytes > 5_000_000_000) throw new TypeError(`adapter.package.files[${index}].sizeBytes must be an integer`);
      return Object.freeze({path, type: file.type === 'directory' ? 'directory' : 'file', sizeBytes, integrity: file.integrity || null});
    });
    if (!files.some(file => file.path === entrypoint && file.type === 'file')) throw new TypeError('adapter.package.entrypoint must reference a declared file');
    const packageSignature = record.package.signature ? Object.freeze({algorithm: required(record.package.signature.algorithm, 'adapter.package.signature.algorithm'), signer: required(record.package.signature.signer, 'adapter.package.signature.signer'), value: required(record.package.signature.value, 'adapter.package.signature.value')}) : null;
    packageDescriptor = Object.freeze({id: packageId, version: packageVersion, kind, platform: packagePlatform, format, entrypoint, files: Object.freeze(files), signature: packageSignature});
  }
  return Object.freeze({id, version, kind, status, trust, platforms, capabilities, license, integrity, signature, artifact, package: packageDescriptor, entrypoint: typeof record.entrypoint === 'string' && record.entrypoint.trim() ? record.entrypoint.trim() : null});
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

function versionParts(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(version);
  if (!match) throw new TypeError(`adapter version must use semver: ${version}`);
  return [Number(match[1]), Number(match[2]), Number(match[3]), match[4] || ''];
}

function compareVersions(left, right) {
  const a = versionParts(left); const b = versionParts(right);
  for (let index = 0; index < 3; index += 1) if (a[index] !== b[index]) return a[index] - b[index];
  if (!a[3] && b[3]) return 1;
  if (a[3] && !b[3]) return -1;
  return a[3].localeCompare(b[3]);
}

/** Select the highest verified compatible release without mutating installed state. */
export function createAdapterUpdatePlan({current, candidates = [], platform, kind, allowUnsigned = false} = {}) {
  const installed = normalizeAdapterManifest(current);
  const compatible = candidates.map(normalizeAdapterManifest)
    .filter(candidate => candidate.id === installed.id && (!kind || candidate.kind === kind))
    .filter(candidate => !platform || candidate.platforms.includes(platform) || candidate.platforms.includes('universal'))
    .filter(candidate => compareVersions(candidate.version, installed.version) > 0)
    .sort((left, right) => compareVersions(right.version, left.version));
  const selected = compatible.find(candidate => ['ready', 'ready-unsigned'].includes(evaluateAdapterManifest(candidate, {platform, kind, allowUnsigned}).status));
  if (!selected) return Object.freeze({id: installed.id, status: 'up-to-date', version: installed.version, reason: compatible.length ? 'newer candidates are not trusted or compatible' : 'no newer compatible release is available'});
  const readiness = evaluateAdapterManifest(selected, {platform, kind, allowUnsigned});
  return Object.freeze({id: installed.id, status: 'update-available', from: installed.version, to: selected.version, adapter: selected, readiness});
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
