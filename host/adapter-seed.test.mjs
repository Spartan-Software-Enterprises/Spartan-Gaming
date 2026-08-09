import assert from 'node:assert/strict';
import {createHash, generateKeyPairSync} from 'node:crypto';
import {promises as fs} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import test from 'node:test';
import {normalizeReleaseFeed, verifyReleaseFeed} from './release-feed.mjs';
import {normalizeAdapterPackageManifest} from './adapter-package.mjs';
import {signPackageManifest} from './package-signing.mjs';
import {readSeedBundle, createSeedArtifactResolver, runSeedInstall, createSeedContextScript} from './adapter-seed.mjs';

const digest = bytes => `sha256-${createHash('sha256').update(bytes).digest('base64url')}`;

function makeTar(binary) {
  const header = new Uint8Array(512); header.set(new TextEncoder().encode('bin/dolphin'), 0);
  header.set(new TextEncoder().encode(binary.length.toString(8).padStart(11, '0')), 124); header[156] = 48;
  const archive = new Uint8Array(512 + binary.length + (512 - (binary.length % 512)) % 512 + 1024);
  archive.set(header); archive.set(binary, 512); return archive;
}

async function signKeyPair() {
  const {privateKey, publicKey} = generateKeyPairSync('ec', {namedCurve: 'P-256'});
  const signKey = await globalThis.crypto.subtle.importKey('jwk', privateKey.export({format: 'jwk'}), {name: 'ECDSA', namedCurve: 'P-256'}, false, ['sign']);
  return {signKey, publicKeyJwk: publicKey.export({format: 'jwk'})};
}

async function buildSeedFixture(root) {
  const binary = new TextEncoder().encode('dolphin-binary'); const archive = makeTar(binary); const archiveIntegrity = digest(archive); const entryIntegrity = digest(binary);
  const {signKey, publicKeyJwk} = await signKeyPair();
  const hostNormalized = normalizeAdapterPackageManifest({...{id: 'dolphin', version: '1.0.0', kind: 'emulator', platform: 'linux', format: 'tar', entrypoint: 'bin/dolphin', files: [{path: 'bin', type: 'directory', sizeBytes: 0}, {path: 'bin/dolphin', sizeBytes: binary.length, integrity: entryIntegrity}]}, signature: {algorithm: 'ECDSA-P256-SHA256', signer: 'spartan-release', value: 'pending'}});
  const signedPackage = await signPackageManifest({manifest: {...hostNormalized, signature: undefined}, privateKey: signKey, signer: 'spartan-release'});
  const record = {id: 'dolphin', version: '1.0.0', kind: 'emulator', status: 'available', trust: 'signed', platforms: ['linux'], capabilities: ['video', 'audio'], license: 'GPL-2.0-or-later', integrity: archiveIntegrity, signature: {algorithm: 'ECDSA-P256-SHA256', signer: 'spartan-release', value: 'adapter-signature'}, artifact: {url: 'https://releases.example.test/dolphin-1.0.0-linux.tar', sizeBytes: archive.length, integrity: archiveIntegrity}, package: signedPackage};
  const unsigned = normalizeReleaseFeed({schemaVersion: 1, updatedAt: '2026-08-09', signer: 'spartan-release', records: [record]});
  const signedFeed = await signPackageManifest({manifest: {...unsigned, signature: undefined}, privateKey: signKey, signer: 'spartan-release'});
  const seedRoot = resolve(root);
  await fs.mkdir(join(seedRoot, 'artifacts'), {recursive: true});
  await fs.writeFile(join(seedRoot, 'feed.json'), JSON.stringify(signedFeed), 'utf8');
  await fs.writeFile(join(seedRoot, 'public-key.jwk.json'), JSON.stringify(publicKeyJwk), 'utf8');
  await fs.writeFile(join(seedRoot, 'artifacts', 'dolphin-1.0.0-linux.tar'), archive);
  return {seedRoot, archive};
}

test('seed bundle exposes a verified feed and a local artifact resolver', async () => {
  const root = await fs.mkdtemp(join(tmpdir(), 'spartan-seed-'));
  try {
    const {seedRoot, archive} = await buildSeedFixture(root);
    const bundle = await readSeedBundle({seedRoot, platform: 'linux'});
    assert.equal(bundle.feed.schemaVersion, 1);
    assert.equal(await verifyReleaseFeed({feed: bundle.feed, publicKeyJwk: bundle.publicKeyJwk}), true);
    const resolver = createSeedArtifactResolver({seedRoot});
    const bytes = await resolver('https://releases.example.test/dolphin-1.0.0-linux.tar');
    assert.deepEqual(Buffer.from(bytes), Buffer.from(archive));
    await assert.rejects(() => resolver('https://releases.example.test/foo\\bar'), /unsafe/);
  } finally { await fs.rm(root, {recursive: true, force: true}); }
});

test('seed install applies bundled adapters and reports up-to-date on refresh', async () => {
  const root = await fs.mkdtemp(join(tmpdir(), 'spartan-seed-'));
  const installRoot = join(root, 'home');
  try {
    const {seedRoot, archive} = await buildSeedFixture(root);
    const planned = await runSeedInstall({seedRoot, installRoot, platform: 'linux', apply: false});
    assert.equal(planned.verified, true);
    assert.equal(planned.installs.length, 1);
    assert.equal(planned.installs[0].status, 'install-available');
    const applied = await runSeedInstall({seedRoot, installRoot, platform: 'linux', apply: true, download: async () => archive});
    assert.equal(applied.applied[0].status, 'installed');
    assert.deepEqual(Buffer.from(await fs.readFile(join(installRoot, 'dolphin', '1.0.0', 'bin', 'dolphin'))), Buffer.from(new TextEncoder().encode('dolphin-binary')));
    const refreshed = await runSeedInstall({seedRoot, installRoot, platform: 'linux', apply: false});
    assert.equal(refreshed.plans[0].status, 'up-to-date');
    assert.equal(refreshed.installs.length, 0);
  } finally { await fs.rm(root, {recursive: true, force: true}); }
});

test('seed context script injects the bundled feed and adapter manifests', async () => {
  const root = await fs.mkdtemp(join(tmpdir(), 'spartan-seed-'));
  try {
    const {seedRoot} = await buildSeedFixture(root);
    const script = await createSeedContextScript({seedRoot, platform: 'linux'});
    assert.equal(script.path, 'spartan-seed-context.js');
    const body = script.render();
    const vm = await import('node:vm');
    const sandbox = {globalThis: {}}; sandbox.globalThis = sandbox;
    vm.runInNewContext(body, sandbox);
    assert.equal(sandbox.__SPARTAN_RELEASE_FEED__.schemaVersion, 1);
    assert.equal(sandbox.__SPARTAN_RELEASE_FEED__.records[0].id, 'dolphin');
    assert.equal(sandbox.__SPARTAN_ADAPTER_MANIFESTS__.length, 1);
    assert.equal(sandbox.__SPARTAN_ADAPTER_MANIFESTS__[0].id, 'dolphin');
  } finally { await fs.rm(root, {recursive: true, force: true}); }
});
