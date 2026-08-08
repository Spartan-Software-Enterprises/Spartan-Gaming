import {createHash} from 'node:crypto';
import {promises as defaultFs} from 'node:fs';
import {dirname, isAbsolute, relative, resolve, sep} from 'node:path';
import {posix as posixPath} from 'node:path';
import {createArchiveReader} from './archive-readers.mjs';

const PLATFORMS = new Set(['win32', 'darwin', 'linux', 'universal']);
const FORMATS = new Set(['zip', 'tar', 'tar.zst', 'directory']);
const TYPES = new Set(['file', 'directory']);
const KINDS = new Set(['capture', 'audio', 'input']);
const MAX_FILES = 100_000;
const MAX_TOTAL_BYTES = 5_000_000_000;

function required(value, name) { if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`); return value.trim(); }
function digest(bytes) { return `sha256-${createHash('sha256').update(bytes).digest('base64url')}`; }
function bytesFrom(value) { if (value instanceof Uint8Array) return value; if (value instanceof ArrayBuffer) return new Uint8Array(value); throw new TypeError('package entry must be Uint8Array or ArrayBuffer'); }
function safePath(value, name) {
  const path = required(value, name).replaceAll('\\', '/');
  if (path.startsWith('/') || path.includes('\0') || path.split('/').includes('..') || posixPath.normalize(path) !== path || /^[A-Za-z]:/.test(path)) throw new TypeError(`${name} must be a normalized relative path`);
  return path;
}
function safeDestination(destination) { const root = resolve(required(destination, 'destination')); if (root === sep) throw new TypeError('destination cannot be the filesystem root'); return root; }

export function normalizeAdapterPackageManifest(record) {
  const id = required(record?.id, 'package.id'); const version = required(record?.version, 'package.version'); const kind = required(record?.kind || 'input', 'package.kind'); const platform = required(record?.platform || 'universal', 'package.platform'); const format = required(record?.format, 'package.format');
  if (!KINDS.has(kind)) throw new TypeError(`unsupported package kind: ${kind}`);
  if (!PLATFORMS.has(platform)) throw new TypeError(`unsupported package platform: ${platform}`);
  if (!FORMATS.has(format)) throw new TypeError(`unsupported package format: ${format}`);
  const signature = record.signature;
  if (!signature?.algorithm || !signature.signer || !signature.value) throw new TypeError('a signed package manifest is required');
  if (!Array.isArray(record.files) || !record.files.length || record.files.length > MAX_FILES) throw new RangeError(`package.files must contain 1-${MAX_FILES} entries`);
  const seen = new Set(); let totalBytes = 0;
  const files = record.files.map((entry, index) => {
    const path = safePath(entry?.path, `package.files[${index}].path`); if (seen.has(path)) throw new Error(`duplicate package path: ${path}`); seen.add(path);
    const type = TYPES.has(entry?.type || 'file') ? (entry.type || 'file') : null; if (!type) throw new TypeError(`unsupported package entry type at ${path}`);
    const sizeBytes = Number(entry?.sizeBytes ?? 0); if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0 || sizeBytes > MAX_TOTAL_BYTES) throw new RangeError(`invalid package entry size: ${path}`);
    const integrity = type === 'file' ? required(entry?.integrity, `package.files[${index}].integrity`) : null; if (integrity && !/^sha256-[A-Za-z0-9_-]+$/.test(integrity)) throw new TypeError(`invalid package entry integrity: ${path}`);
    totalBytes += sizeBytes; if (totalBytes > MAX_TOTAL_BYTES) throw new RangeError('package total size exceeds the supported bound');
    return Object.freeze({path, type, sizeBytes, integrity});
  });
  const entrypoint = record.entrypoint === undefined || record.entrypoint === null ? null : safePath(record.entrypoint, 'package.entrypoint');
  if (entrypoint && (!seen.has(entrypoint) || files.find(entry => entry.path === entrypoint)?.type !== 'file')) throw new TypeError('package.entrypoint must reference a declared file');
  return Object.freeze({id, version, kind, platform, format, signature: Object.freeze({algorithm: String(signature.algorithm), signer: String(signature.signer), value: String(signature.value)}), files: Object.freeze(files), entrypoint, totalBytes});
}

export function createPackageExtractionPlan({manifest, destination} = {}) {
  const normalized = normalizeAdapterPackageManifest(manifest); const root = safeDestination(destination);
  const entries = normalized.files.map(entry => { const target = resolve(root, ...entry.path.split('/')); const tail = relative(root, target); if (!tail || tail.startsWith('..') || isAbsolute(tail)) throw new Error(`package path escapes destination: ${entry.path}`); return Object.freeze({...entry, target}); });
  return Object.freeze({manifest: normalized, destination: root, entries: Object.freeze(entries)});
}

export async function verifyPackageEntries({manifest, readEntry} = {}) {
  const normalized = normalizeAdapterPackageManifest(manifest); if (typeof readEntry !== 'function') throw new TypeError('readEntry must be a function');
  let verifiedBytes = 0;
  for (const entry of normalized.files) {
    if (entry.type === 'directory') continue;
    const bytes = bytesFrom(await readEntry(entry.path));
    if (bytes.byteLength !== entry.sizeBytes) throw new Error(`package entry size mismatch: ${entry.path}`);
    if (digest(bytes) !== entry.integrity) throw new Error(`package entry digest mismatch: ${entry.path}`);
    verifiedBytes += bytes.byteLength;
  }
  return Object.freeze({status: 'verified', id: normalized.id, version: normalized.version, files: normalized.files.length, bytes: verifiedBytes});
}

/** Extract through an injected archive reader into a new staging directory. */
export async function extractAdapterPackage({manifest, destination, extractEntry, fsImpl = defaultFs} = {}) {
  const plan = createPackageExtractionPlan({manifest, destination});
  if (typeof extractEntry !== 'function') throw new TypeError('extractEntry must be a function');
  if (!fsImpl || typeof fsImpl.access !== 'function' || typeof fsImpl.mkdir !== 'function' || typeof fsImpl.writeFile !== 'function' || typeof fsImpl.rm !== 'function') throw new TypeError('filesystem adapter is incomplete');
  await fsImpl.access(plan.destination).then(() => { throw new Error('package destination already exists'); }).catch(error => { if (error?.code !== 'ENOENT') throw error; });
  const created = [];
  try {
    await fsImpl.mkdir(plan.destination, {recursive: false});
    for (const entry of plan.entries) {
      if (entry.type === 'directory') { await fsImpl.mkdir(entry.target, {recursive: false}); continue; }
      const bytes = bytesFrom(await extractEntry(entry.path));
      if (bytes.byteLength !== entry.sizeBytes || digest(bytes) !== entry.integrity) throw new Error(`package entry verification failed: ${entry.path}`);
      await fsImpl.mkdir(dirname(entry.target), {recursive: true});
      await fsImpl.writeFile(entry.target, bytes, {flag: 'wx'}); created.push(entry.target);
    }
    return Object.freeze({status: 'extracted', id: plan.manifest.id, version: plan.manifest.version, destination: plan.destination, files: plan.entries.length});
  } catch (error) {
    await fsImpl.rm(plan.destination, {recursive: true, force: true}).catch(() => {});
    throw error;
  }
}

/** Use a built-in ZIP/TAR reader, or fail closed for formats needing an adapter. */
export async function extractAdapterArchive({manifest, data, destination, fsImpl = defaultFs} = {}) {
  const reader = createArchiveReader({format: manifest?.format, data});
  return extractAdapterPackage({manifest, destination, fsImpl, extractEntry: path => reader.read(path)});
}
