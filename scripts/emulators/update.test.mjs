import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { normalizeReleaseFeed, verifyReleaseFeed } from '../../host/release-feed.mjs';
import { normalizeAdapterPackageManifest } from '../../host/adapter-package.mjs';
import { signPackageManifest } from '../../host/package-signing.mjs';
import { parseUpdateArgs, runEmulatorUpdate } from './update.mjs';

const digest = (bytes) => `sha256-${createHash('sha256').update(bytes).digest('base64url')}`;

function makeTar(binary) {
  const header = new Uint8Array(512);
  header.set(new TextEncoder().encode('bin/dolphin'), 0);
  header.set(new TextEncoder().encode(binary.length.toString(8).padStart(11, '0')), 124);
  header[156] = 48;
  const archive = new Uint8Array(
    512 + binary.length + ((512 - (binary.length % 512)) % 512) + 1024,
  );
  archive.set(header);
  archive.set(binary, 512);
  return archive;
}

async function makeFeed({ record, privateKey, signer = 'spartan-release' }) {
  const unsigned = normalizeReleaseFeed({
    schemaVersion: 1,
    updatedAt: '2026-08-09',
    signer,
    records: [record],
  });
  const signed = await signPackageManifest({ manifest: unsigned, privateKey, signer });
  return normalizeReleaseFeed(signed);
}

test('emulator updater parses CLI flags and plans a verified release feed', async () => {
  const options = parseUpdateArgs([
    '--feed',
    'https://releases.example.test/feed.json',
    '--key',
    '/tmp/key.json',
    '--install-root',
    '/tmp/adapters',
    '--platform',
    'linux',
  ]);
  assert.equal(options.platform, 'linux');
  assert.equal(options.apply, false);
  assert.throws(() => parseUpdateArgs(['--feed', 'x']), /--key/);
});

test('emulator updater installs, verifies, and updates a packaged emulator release', async () => {
  const binary = new TextEncoder().encode('dolphin-binary');
  const archive = makeTar(binary);
  const archiveIntegrity = digest(archive);
  const entryIntegrity = digest(binary);
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const privateJwk = privateKey.export({ format: 'jwk' });
  const signKey = await globalThis.crypto.subtle.importKey(
    'jwk',
    privateJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const unsignedPackage = {
    id: 'dolphin',
    version: '1.0.0',
    kind: 'emulator',
    platform: 'linux',
    format: 'tar',
    entrypoint: 'bin/dolphin',
    files: [
      { path: 'bin', type: 'directory', sizeBytes: 0 },
      { path: 'bin/dolphin', sizeBytes: binary.length, integrity: entryIntegrity },
    ],
  };
  const hostNormalized = normalizeAdapterPackageManifest({
    ...unsignedPackage,
    signature: { algorithm: 'ECDSA-P256-SHA256', signer: 'spartan-release', value: 'pending' },
  });
  const signedPackage = await signPackageManifest({
    manifest: { ...hostNormalized, signature: undefined },
    privateKey: signKey,
    signer: 'spartan-release',
  });
  const record = {
    id: 'dolphin',
    version: '1.0.0',
    kind: 'emulator',
    status: 'available',
    trust: 'signed',
    platforms: ['linux'],
    capabilities: ['video', 'audio'],
    license: 'GPL-2.0-or-later',
    integrity: archiveIntegrity,
    signature: {
      algorithm: 'ECDSA-P256-SHA256',
      signer: 'spartan-release',
      value: 'adapter-signature',
    },
    artifact: {
      url: 'https://releases.example.test/dolphin.tar',
      sizeBytes: archive.length,
      integrity: archiveIntegrity,
    },
    package: signedPackage,
  };
  const feed = await makeFeed({ record, privateKey: signKey });
  const publicKeyJwk = publicKey.export({ format: 'jwk' });
  const root = await fs.mkdtemp(join(tmpdir(), 'spartan-updater-'));
  try {
    assert.equal(await verifyReleaseFeed({ feed, publicKeyJwk }), true);
    const planned = await runEmulatorUpdate({
      feed,
      publicKeyJwk,
      installRoot: root,
      platform: 'linux',
      apply: false,
    });
    assert.equal(planned.installs.length, 1);
    assert.equal(planned.installs[0].status, 'install-available');
    const applied = await runEmulatorUpdate({
      feed,
      publicKeyJwk,
      installRoot: root,
      platform: 'linux',
      apply: true,
      download: async () => archive,
    });
    assert.equal(applied.applied[0].status, 'installed');
    assert.deepEqual(
      Buffer.from(await fs.readFile(join(root, 'dolphin', '1.0.0', 'bin', 'dolphin'))),
      Buffer.from(binary),
    );
    const refreshed = await runEmulatorUpdate({
      feed,
      publicKeyJwk,
      installRoot: root,
      platform: 'linux',
      apply: false,
    });
    assert.equal(refreshed.plans[0].status, 'up-to-date');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
