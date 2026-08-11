import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalPayload, loadVerifiedBrowserEmulatorAdapter } from './browser-adapter-loader.mjs';

const moduleBytes = new TextEncoder().encode('spartan-browser-adapter');
const manifest = {
  id: 'libretro-snes',
  version: '1.0.0',
  kind: 'emulator',
  status: 'installed',
  trust: 'signed',
  platforms: ['browser'],
  capabilities: ['video', 'audio', 'gamepad'],
  license: 'MIT',
  integrity: 'sha256-c3BhcnRhbi1icm93c2VyLWFkYXB0ZXI',
  signature: { algorithm: 'ECDSA-P256-SHA256', signer: 'spartan-release', value: 'c2lnbmF0dXJl' },
  entrypoint: 'https://cdn.example.test/libretro-snes.mjs',
};

function subtleStub() {
  return {
    async digest(algorithm, value) {
      assert.equal(algorithm, 'SHA-256');
      assert.deepEqual(new Uint8Array(value), moduleBytes);
      return Uint8Array.from([
        115, 112, 97, 114, 116, 97, 110, 45, 98, 114, 111, 119, 115, 101, 114, 45, 97, 100, 97, 112,
        116, 101, 114,
      ]).buffer;
    },
    async importKey() {
      return {};
    },
    async verify() {
      return true;
    },
  };
}

test('canonical adapter payload is stable and excludes mutable runtime data', () => {
  assert.equal(
    canonicalPayload(manifest),
    JSON.stringify({
      id: 'libretro-snes',
      version: '1.0.0',
      kind: 'emulator',
      platforms: ['browser'],
      capabilities: ['video', 'audio', 'gamepad'],
      license: 'MIT',
      integrity: manifest.integrity,
      entrypoint: manifest.entrypoint,
    }),
  );
});

test('verified browser adapter loader checks consent, signature, and module integrity', async () => {
  let request;
  const result = await loadVerifiedBrowserEmulatorAdapter({
    manifest,
    consent: true,
    trustedSigners: { 'spartan-release': { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' } },
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 200,
        headers: { get: () => String(moduleBytes.byteLength) },
        arrayBuffer: async () => moduleBytes,
      };
    },
    subtle: subtleStub(),
    importModule: async (value) => {
      assert.deepEqual(value, moduleBytes);
      return { adapter: { id: manifest.id, async load() {}, async start() {}, async stop() {} } };
    },
  });
  assert.equal(result.verified, true);
  assert.equal(result.adapter.id, manifest.id);
  assert.equal(request.url, manifest.entrypoint);
  assert.deepEqual(request.options, {
    method: 'GET',
    credentials: 'omit',
    redirect: 'error',
    cache: 'no-store',
  });
});

test('browser adapter loader fails closed for consent, trust, and integrity errors', async () => {
  await assert.rejects(
    () => loadVerifiedBrowserEmulatorAdapter({ manifest }),
    /explicit user consent/,
  );
  await assert.rejects(
    () => loadVerifiedBrowserEmulatorAdapter({ manifest, consent: true, fetchImpl: null }),
    /requires fetch/,
  );
  await assert.rejects(
    () =>
      loadVerifiedBrowserEmulatorAdapter({
        manifest,
        consent: true,
        trustedSigners: {},
        fetchImpl: async () => ({ ok: true, arrayBuffer: async () => moduleBytes }),
        subtle: subtleStub(),
      }),
    /no trusted public key/,
  );
  const bad = { ...manifest, integrity: 'sha256-YmFk' };
  await assert.rejects(
    () =>
      loadVerifiedBrowserEmulatorAdapter({
        manifest: bad,
        consent: true,
        trustedSigners: { 'spartan-release': {} },
        fetchImpl: async () => ({ ok: true, arrayBuffer: async () => moduleBytes }),
        subtle: subtleStub(),
      }),
    /integrity verification failed/,
  );
});
