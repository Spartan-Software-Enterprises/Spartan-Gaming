import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { normalizeReleaseFeed } from '../../host/release-feed.mjs';
import { signPackageManifest } from '../../host/package-signing.mjs';
import { parseBuildSeedArgs, buildSeedBundle } from './build-seed.mjs';

const digest = (bytes) => `sha256-${createHash('sha256').update(bytes).digest('base64url')}`;

async function makeFixture(root) {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const signKey = await globalThis.crypto.subtle.importKey(
    'jwk',
    privateKey.export({ format: 'jwk' }),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const artifact = new TextEncoder().encode('dolphin-payload');
  const unsigned = normalizeReleaseFeed({
    schemaVersion: 1,
    updatedAt: '2026-08-09',
    signer: 'spartan-release',
    records: [
      {
        id: 'dolphin',
        version: '1.0.0',
        kind: 'emulator',
        status: 'available',
        trust: 'signed',
        platforms: ['linux'],
        capabilities: ['video', 'audio'],
        license: 'GPL-2.0-or-later',
        integrity: digest(artifact),
        signature: {
          algorithm: 'ECDSA-P256-SHA256',
          signer: 'spartan-release',
          value: 'adapter-signature',
        },
        artifact: {
          url: 'https://releases.example.test/dolphin-1.0.0-linux.tar',
          sizeBytes: artifact.byteLength,
          integrity: digest(artifact),
        },
      },
    ],
  });
  const signed = await signPackageManifest({
    manifest: unsigned,
    privateKey: signKey,
    signer: 'spartan-release',
  });
  const feedPath = join(root, 'feed.json');
  await fs.writeFile(feedPath, JSON.stringify(signed), 'utf8');
  const keyPath = join(root, 'key.json');
  await fs.writeFile(keyPath, JSON.stringify(publicKey.export({ format: 'jwk' })), 'utf8');
  const artifacts = join(root, 'artifacts');
  await fs.mkdir(artifacts);
  await fs.writeFile(join(artifacts, 'dolphin-1.0.0-linux.tar'), artifact);
  return { feedPath, keyPath, artifacts };
}

test('seed build copies only verified feed artifacts', async () => {
  const root = await fs.mkdtemp(join(tmpdir(), 'spartan-seed-build-'));
  const out = join(root, 'seed');
  try {
    const fixture = await makeFixture(root);
    const summary = await buildSeedBundle({ ...fixture, outPath: out });
    assert.equal(summary.records.length, 1);
    assert.equal(summary.records[0].name, 'dolphin-1.0.0-linux.tar');
    assert.equal(summary.bytes, 15);
    assert.deepEqual(await fs.readdir(join(out, 'artifacts')), ['dolphin-1.0.0-linux.tar']);
    assert.equal((await fs.readFile(join(out, 'feed.json'), 'utf8')).length > 0, true);
    assert.equal((await fs.readFile(join(out, 'public-key.jwk.json'), 'utf8')).length > 0, true);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('seed build fails closed on tampered, missing, or unreferenced artifacts', async () => {
  const root = await fs.mkdtemp(join(tmpdir(), 'spartan-seed-build-'));
  try {
    const fixture = await makeFixture(root);
    await fs.writeFile(
      join(fixture.artifacts, 'dolphin-1.0.0-linux.tar'),
      new TextEncoder().encode('tampered'),
    );
    await assert.rejects(
      () => buildSeedBundle({ ...fixture, outPath: join(root, 'out-a') }),
      /size mismatch|digest mismatch/,
    );
    await fs.unlink(join(fixture.artifacts, 'dolphin-1.0.0-linux.tar'));
    await assert.rejects(
      () => buildSeedBundle({ ...fixture, outPath: join(root, 'out-b') }),
      /missing bundled artifact/,
    );
    await fs.writeFile(
      join(fixture.artifacts, 'dolphin-1.0.0-linux.tar'),
      new TextEncoder().encode('dolphin-payload'),
    );
    await fs.writeFile(
      join(fixture.artifacts, 'unreferenced.bin'),
      new TextEncoder().encode('extra'),
    );
    await assert.rejects(
      () => buildSeedBundle({ ...fixture, outPath: join(root, 'out-c') }),
      /unreferenced artifact/,
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('seed build parses required CLI flags', () => {
  const options = parseBuildSeedArgs([
    '--feed',
    'a.json',
    '--key',
    'b.json',
    '--artifacts',
    'c',
    '--out',
    'd',
  ]);
  assert.equal(options.feed, 'a.json');
  assert.equal(options.key, 'b.json');
  assert.equal(options.artifacts, 'c');
  assert.equal(options.out, 'd');
  assert.throws(
    () => parseBuildSeedArgs(['--feed', 'a.json']),
    /--key, --artifacts, and --out are required/,
  );
});
