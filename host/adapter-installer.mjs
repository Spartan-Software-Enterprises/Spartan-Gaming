import {createHash, randomUUID} from 'node:crypto';
import {promises as defaultFs} from 'node:fs';
import {resolve, join, relative, isAbsolute} from 'node:path';

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;
const MAX_ARTIFACT_BYTES = 5_000_000_000;

function required(value, name) { if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`); return value.trim(); }
function safeSegment(value, name) { const segment = required(value, name); if (!SAFE_SEGMENT.test(segment) || segment === '.' || segment === '..') throw new TypeError(`${name} contains an unsafe path segment`); return segment; }
function immutablePaths(root, id, version) {
  const base = resolve(root); const adapter = safeSegment(id, 'request.id'); const release = safeSegment(version, 'request.to');
  const target = resolve(base, adapter, release); const pointer = resolve(base, adapter, 'current.json');
  if (relative(base, target).startsWith('..') || isAbsolute(relative(base, target)) || relative(base, pointer).startsWith('..')) throw new Error('adapter install path escapes the install root');
  return Object.freeze({root: base, target, pointer, staging: resolve(base, '.staging', `${adapter}-${release}-${randomUUID()}`)});
}

function decodeDigest(integrity) {
  const value = required(integrity, 'artifact.integrity');
  if (!value.startsWith('sha256-')) throw new TypeError('artifact.integrity must use sha256- encoding');
  return value.slice(7);
}

function digest(bytes) { return createHash('sha256').update(bytes).digest('base64url'); }
async function bytesFrom(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (value?.arrayBuffer && typeof value.arrayBuffer === 'function') return new Uint8Array(await value.arrayBuffer());
  throw new TypeError('download must return Uint8Array, ArrayBuffer, or a response with arrayBuffer()');
}

/** Create a validated, side-effect-free transaction plan for one adapter release. */
export function createAdapterInstallTransactionPlan({request, installRoot} = {}) {
  if (request?.version !== 1 || request.installScope !== 'user') throw new TypeError('a version 1 user-scoped adapter request is required');
  if (!request.artifact || request.requiresRestart !== true) throw new TypeError('adapter request must include an artifact and restart requirement');
  if (!request.verification?.signature?.algorithm || !request.verification.signature.signer || !request.verification.signature.value) throw new TypeError('a signed adapter verification record is required');
  const paths = immutablePaths(installRoot, request.id, request.to);
  const expected = decodeDigest(request.artifact.integrity);
  if (request.verification?.integrity !== request.artifact.integrity) throw new TypeError('request verification integrity must match artifact integrity');
  if (request.artifact.sizeBytes < 1 || request.artifact.sizeBytes > MAX_ARTIFACT_BYTES) throw new RangeError('artifact size is outside the supported bound');
  return Object.freeze({version: 1, id: request.id, from: request.from, to: request.to, expectedDigest: expected, artifact: Object.freeze({...request.artifact}), paths});
}

/**
 * Install signed adapter artifacts through an injected downloader/verifier.
 * The installer writes only inside its validated root and never invokes a shell.
 */
export function createNativeAdapterInstaller({installRoot, fsImpl = defaultFs, download = async url => { const response = await fetch(url); if (!response.ok) throw new Error(`adapter download failed: ${response.status}`); return response; }, verifySignature = async () => { throw new Error('adapter signature verifier is required'); }} = {}) {
  if (!fsImpl || typeof fsImpl.mkdir !== 'function' || typeof fsImpl.writeFile !== 'function' || typeof fsImpl.rename !== 'function' || typeof fsImpl.rm !== 'function' || typeof fsImpl.access !== 'function') throw new TypeError('filesystem adapter is incomplete');
  if (typeof download !== 'function' || typeof verifySignature !== 'function') throw new TypeError('download and verifySignature must be functions');
  return Object.freeze({
    async install(request) {
      const plan = createAdapterInstallTransactionPlan({request, installRoot});
      await fsImpl.mkdir(plan.paths.staging, {recursive: true});
      let published = false; let pointerTemp = null;
      try {
        const content = await bytesFrom(await download(plan.artifact.url));
        if (content.byteLength !== plan.artifact.sizeBytes) throw new Error('downloaded adapter size does not match the signed descriptor');
        if (digest(content) !== plan.expectedDigest) throw new Error('downloaded adapter digest does not match the signed descriptor');
        if (!await verifySignature({data: content, signature: request.verification.signature, request})) throw new Error('adapter signature verification failed');
        await fsImpl.writeFile(join(plan.paths.staging, 'adapter.artifact'), content, {flag: 'wx'});
        await fsImpl.writeFile(join(plan.paths.staging, 'manifest.json'), JSON.stringify({id: plan.id, version: plan.to, integrity: plan.artifact.integrity}), {encoding: 'utf8', flag: 'wx'});
        await fsImpl.mkdir(resolve(plan.paths.root, plan.id), {recursive: true});
        await fsImpl.access(plan.paths.target).then(() => { throw new Error('adapter version is already installed'); }).catch(error => { if (error?.code !== 'ENOENT') throw error; });
        await fsImpl.rename(plan.paths.staging, plan.paths.target);
        published = true;
        pointerTemp = `${plan.paths.pointer}.${randomUUID()}.tmp`;
        await fsImpl.writeFile(pointerTemp, JSON.stringify({id: plan.id, version: plan.to, integrity: plan.artifact.integrity}), {encoding: 'utf8', flag: 'wx'});
        await fsImpl.rename(pointerTemp, plan.paths.pointer);
        return Object.freeze({status: 'installed', id: plan.id, version: plan.to, path: plan.paths.target});
      } catch (error) {
        if (published) await fsImpl.rm(plan.paths.target, {recursive: true, force: true}).catch(() => {});
        await fsImpl.rm(plan.paths.staging, {recursive: true, force: true}).catch(() => {});
        if (pointerTemp) await fsImpl.rm(pointerTemp, {force: true}).catch(() => {});
        throw error;
      }
    },
  });
}
