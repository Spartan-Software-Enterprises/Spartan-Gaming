import {promises as defaultFs} from 'node:fs';
import {isAbsolute, join, relative, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {normalizeAdapterPackageManifest, verifyPackageEntries} from './adapter-package.mjs';
import {verifyPackageManifestSignature} from './package-signing.mjs';
import {createPlatformAdapterBoundary} from './platform-adapters.mjs';

const PLATFORMS = new Set(['win32', 'darwin', 'linux']);
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;
function required(value, name) { if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`); return value.trim(); }
function segment(value, name) { const result = required(value, name); if (!SAFE_SEGMENT.test(result) || result === '.' || result === '..') throw new TypeError(`${name} contains an unsafe path segment`); return result; }
function inside(root, target) { const tail = relative(root, target); if (!tail || tail.startsWith('..') || isAbsolute(tail)) throw new Error('adapter path escapes the install root'); return target; }
async function readJson(fsImpl, path, name) { try { return JSON.parse(await fsImpl.readFile(path, 'utf8')); } catch (error) { throw new Error(`unable to read ${name}: ${error.message}`); } }

/** Verify both the signed manifest and every installed file before activation. */
export function createInstalledAdapterManifestVerifier({publicKeyJwk, subtle = globalThis.crypto?.subtle, fsImpl = defaultFs} = {}) {
  if (!publicKeyJwk || typeof publicKeyJwk !== 'object' || Array.isArray(publicKeyJwk)) throw new TypeError('public key JWK must be an object');
  if (!fsImpl || typeof fsImpl.readFile !== 'function') throw new TypeError('filesystem adapter must implement readFile');
  return async ({manifest, target} = {}) => {
    if (!await verifyPackageManifestSignature({manifest, publicKeyJwk, subtle})) return false;
    try { await verifyPackageEntries({manifest, readEntry: entry => fsImpl.readFile(join(target, ...entry.split('/')))}); return true; }
    catch { return false; }
  };
}

/** Activate only a verified, platform-matched adapter package from an install root. */
export function createInstalledAdapterRuntime({installRoot, id, platform, expectedKind = 'input', fsImpl = defaultFs, loadModule = specifier => import(specifier), verifyManifest} = {}) {
  const root = resolve(required(installRoot, 'installRoot')); const adapterId = segment(id, 'id');
  if (!PLATFORMS.has(platform)) throw new TypeError(`unsupported adapter runtime platform: ${platform}`);
  if (!['capture', 'audio', 'input', 'virtual-gamepad'].includes(expectedKind)) throw new TypeError(`unsupported adapter runtime kind: ${expectedKind}`);
  if (!fsImpl || typeof fsImpl.readFile !== 'function') throw new TypeError('filesystem adapter must implement readFile');
  if (typeof loadModule !== 'function' || typeof verifyManifest !== 'function') throw new TypeError('loadModule and verifyManifest are required');
  const currentPath = inside(root, join(root, adapterId, 'current.json'));
  async function inspect() {
    const pointer = await readJson(fsImpl, currentPath, 'adapter pointer');
    if (pointer.id !== adapterId) throw new Error('installed adapter pointer id mismatch');
    const version = segment(pointer.version, 'installed adapter version'); const target = inside(root, join(root, adapterId, version));
    const manifest = normalizeAdapterPackageManifest(await readJson(fsImpl, join(target, 'manifest.json'), 'adapter package manifest'));
    if (manifest.id !== adapterId || manifest.version !== version) throw new Error('installed adapter manifest identity mismatch');
    if (manifest.kind !== expectedKind) throw new Error('installed adapter kind mismatch');
    if (manifest.platform !== 'universal' && manifest.platform !== platform) throw new Error('installed adapter platform mismatch');
    if (!manifest.entrypoint) throw new Error('installed adapter has no entrypoint');
    if (pointer.integrity && pointer.integrity !== manifest.signature.value && pointer.integrity !== manifest.files.find(file => file.path === manifest.entrypoint)?.integrity) throw new Error('installed adapter pointer integrity mismatch');
    const entrypoint = inside(target, resolve(target, ...manifest.entrypoint.split('/')));
    return Object.freeze({pointer: Object.freeze(pointer), manifest, target, entrypoint});
  }
  return Object.freeze({async inspect() { return inspect(); }, async load() { const record = await inspect(); if (!await verifyManifest({manifest: record.manifest, target: record.target})) throw new Error('installed adapter manifest verification failed'); const module = await loadModule(pathToFileURL(record.entrypoint).href); const factoryName = expectedKind === 'virtual-gamepad' ? 'createVirtualGamepad' : 'createPlatformAdapter'; if (typeof module?.[factoryName] !== 'function') throw new TypeError(`adapter entrypoint must export ${factoryName}`); const adapter = await module[factoryName]({platform, kind: record.manifest.kind, manifest: record.manifest}); const validIdentity = adapter?.platform === platform && (expectedKind === 'virtual-gamepad' ? (!adapter.kind || adapter.kind === 'virtual-gamepad') : adapter.kind === expectedKind); if (!adapter || !validIdentity) throw new TypeError('adapter factory returned an invalid platform adapter'); const requiredOperation = expectedKind === 'audio' ? 'start' : 'execute'; if (typeof adapter[requiredOperation] !== 'function') throw new TypeError(`adapter factory must implement ${requiredOperation}()`); return Object.freeze({manifest: record.manifest, adapter}); }, async createBoundary({registry, kind = expectedKind} = {}) { if (kind !== expectedKind) throw new Error('requested adapter kind does not match the installed package'); if (expectedKind === 'virtual-gamepad') throw new Error('virtual-gamepad adapters must be activated through the virtual-gamepad loader'); const descriptor = registry?.get?.(kind); if (!descriptor || descriptor.state !== 'ready') throw new Error(`platform adapter is not ready for ${kind}`); const loaded = await this.load(); const boundary = createPlatformAdapterBoundary({platform, registry, implementations: {[kind]: loaded.adapter}}); return Object.freeze({boundary, adapter: loaded.adapter, manifest: loaded.manifest}); }});
}
