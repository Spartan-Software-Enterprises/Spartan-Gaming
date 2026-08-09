import {promises as defaultFs} from 'node:fs';
import {isAbsolute, join, relative, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {normalizeAdapterPackageManifest} from './adapter-package.mjs';
import {createPlatformAdapterBoundary} from './platform-adapters.mjs';

const PLATFORMS = new Set(['win32', 'darwin', 'linux']);
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;
function required(value, name) { if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`); return value.trim(); }
function segment(value, name) { const result = required(value, name); if (!SAFE_SEGMENT.test(result) || result === '.' || result === '..') throw new TypeError(`${name} contains an unsafe path segment`); return result; }
function inside(root, target) { const tail = relative(root, target); if (!tail || tail.startsWith('..') || isAbsolute(tail)) throw new Error('adapter path escapes the install root'); return target; }
async function readJson(fsImpl, path, name) { try { return JSON.parse(await fsImpl.readFile(path, 'utf8')); } catch (error) { throw new Error(`unable to read ${name}: ${error.message}`); } }

/** Activate only a verified, platform-matched adapter package from an install root. */
export function createInstalledAdapterRuntime({installRoot, id, platform, expectedKind = 'input', fsImpl = defaultFs, loadModule = specifier => import(specifier), verifyManifest} = {}) {
  const root = resolve(required(installRoot, 'installRoot')); const adapterId = segment(id, 'id');
  if (!PLATFORMS.has(platform)) throw new TypeError(`unsupported adapter runtime platform: ${platform}`);
  if (!['capture', 'audio', 'input'].includes(expectedKind)) throw new TypeError(`unsupported adapter runtime kind: ${expectedKind}`);
  if (!fsImpl || typeof fsImpl.readFile !== 'function' || typeof fsImpl.access !== 'function') throw new TypeError('filesystem adapter must implement readFile and access');
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
  return Object.freeze({async inspect() { return inspect(); }, async load() { const record = await inspect(); if (!await verifyManifest({manifest: record.manifest, target: record.target})) throw new Error('installed adapter manifest verification failed'); const module = await loadModule(pathToFileURL(record.entrypoint).href); if (typeof module?.createPlatformAdapter !== 'function') throw new TypeError('adapter entrypoint must export createPlatformAdapter'); const adapter = await module.createPlatformAdapter({platform, kind: record.manifest.kind, manifest: record.manifest}); if (!adapter || adapter.platform !== platform || adapter.kind !== expectedKind) throw new TypeError('adapter factory returned an invalid platform adapter'); const requiredOperation = expectedKind === 'input' ? 'execute' : 'start'; if (typeof adapter[requiredOperation] !== 'function') throw new TypeError(`adapter factory must implement ${requiredOperation}()`); return Object.freeze({manifest: record.manifest, adapter}); }, async createBoundary({registry, kind = expectedKind} = {}) { if (kind !== expectedKind) throw new Error('requested adapter kind does not match the installed package'); const descriptor = registry?.get?.(kind); if (!descriptor || descriptor.state !== 'ready') throw new Error(`platform adapter is not ready for ${kind}`); const loaded = await this.load(); const boundary = createPlatformAdapterBoundary({platform, registry, implementations: {[kind]: loaded.adapter}}); return Object.freeze({boundary, adapter: loaded.adapter, manifest: loaded.manifest}); }});
}

/** Resolve a signed installed emulator to a local executable for the host. */
export function createInstalledEmulatorRuntime({installRoot, id, platform, fsImpl = defaultFs, verifyManifest} = {}) {
  const root = resolve(required(installRoot, 'installRoot')); const emulatorId = segment(id, 'id');
  if (!PLATFORMS.has(platform)) throw new TypeError(`unsupported emulator runtime platform: ${platform}`);
  if (!fsImpl || typeof fsImpl.readFile !== 'function') throw new TypeError('filesystem adapter must implement readFile');
  if (typeof verifyManifest !== 'function') throw new TypeError('verifyManifest is required');
  const currentPath = inside(root, join(root, emulatorId, 'current.json'));
  return Object.freeze({
    async inspect() {
      const pointer = await readJson(fsImpl, currentPath, 'emulator pointer');
      if (pointer.id !== emulatorId) throw new Error('installed emulator pointer id mismatch');
      const version = segment(pointer.version, 'installed emulator version'); const target = inside(root, join(root, emulatorId, version));
      const manifest = normalizeAdapterPackageManifest(await readJson(fsImpl, join(target, 'manifest.json'), 'emulator package manifest'));
      if (manifest.id !== emulatorId || manifest.version !== version) throw new Error('installed emulator manifest identity mismatch');
      if (manifest.kind !== 'emulator') throw new Error('installed package is not an emulator');
      if (manifest.platform !== 'universal' && manifest.platform !== platform) throw new Error('installed emulator platform mismatch');
      if (!manifest.entrypoint) throw new Error('installed emulator has no entrypoint');
      if (!await verifyManifest({manifest, target})) throw new Error('installed emulator manifest verification failed');
      const entrypoint = inside(target, resolve(target, ...manifest.entrypoint.split('/')));
      await fsImpl.access(entrypoint);
      return Object.freeze({id: emulatorId, version, manifest, target, entrypoint});
    },
  });
}
