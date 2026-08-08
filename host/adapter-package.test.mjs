import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {promises as fs} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import test from 'node:test';
import {createPackageExtractionPlan, extractAdapterPackage, normalizeAdapterPackageManifest, verifyPackageEntries} from './adapter-package.mjs';

const readme = new TextEncoder().encode('adapter readme');
const binary = new Uint8Array([1, 2, 3, 4]);
const hash = bytes => `sha256-${createHash('sha256').update(bytes).digest('base64url')}`;
const manifest = {id: 'dolphin-native', version: '1.1.0', platform: 'linux', format: 'tar.zst', signature: {algorithm: 'ECDSA-P256-SHA256', signer: 'release', value: 'sig'}, entrypoint: 'bin/adapter', files: [{path: 'README.txt', sizeBytes: readme.byteLength, integrity: hash(readme)}, {path: 'bin', type: 'directory', sizeBytes: 0}, {path: 'bin/adapter', sizeBytes: binary.byteLength, integrity: hash(binary)}]};

test('package manifests normalize files and reject traversal, duplicates, and symlink-like entries', () => { const normalized = normalizeAdapterPackageManifest(manifest); assert.equal(normalized.totalBytes, readme.byteLength + binary.byteLength); assert.throws(() => normalizeAdapterPackageManifest({...manifest, files: [{...manifest.files[0], path: '../escape'}]}), /relative path/); assert.throws(() => normalizeAdapterPackageManifest({...manifest, files: [{...manifest.files[0]}, {...manifest.files[0]}]}), /duplicate/); assert.throws(() => normalizeAdapterPackageManifest({...manifest, files: [{path: 'link', type: 'symlink', sizeBytes: 0}]}), /entry type/); });
test('package extraction plans keep every target inside the destination', () => { const destination = resolve('/tmp/spartan-package'); const plan = createPackageExtractionPlan({manifest, destination}); assert.equal(plan.entries.find(entry => entry.path === 'bin/adapter').target, resolve(destination, 'bin/adapter')); assert.throws(() => createPackageExtractionPlan({manifest: {...manifest, files: [{...manifest.files[0], path: '/absolute'}]}, destination}), /relative path/); });
test('package entry verification checks every file digest and size', async () => { const result = await verifyPackageEntries({manifest, readEntry: path => path === 'README.txt' ? readme : binary}); assert.equal(result.status, 'verified'); await assert.rejects(() => verifyPackageEntries({manifest, readEntry: () => new Uint8Array([9])}), /size mismatch/); });
test('package extraction verifies before writing and rolls back on failure', async () => { const root = await fs.mkdtemp(join(tmpdir(), 'spartan-package-')); const destination = join(root, 'release'); try { const result = await extractAdapterPackage({manifest, destination, extractEntry: path => path === 'README.txt' ? readme : binary}); assert.equal(result.status, 'extracted'); assert.equal((await fs.readFile(join(destination, 'bin/adapter'))).length, binary.length); } finally { await fs.rm(root, {recursive: true, force: true}); } const badRoot = await fs.mkdtemp(join(tmpdir(), 'spartan-package-')); try { await assert.rejects(() => extractAdapterPackage({manifest, destination: join(badRoot, 'release'), extractEntry: () => new Uint8Array([0])}), /verification/); await assert.rejects(() => fs.access(join(badRoot, 'release'))); } finally { await fs.rm(badRoot, {recursive: true, force: true}); } });
