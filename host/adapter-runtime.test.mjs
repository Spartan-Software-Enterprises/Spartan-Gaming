import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  createInstalledAdapterManifestVerifier,
  createInstalledAdapterRuntime,
  createInstalledEmulatorRuntime,
} from './adapter-runtime.mjs';

const manifest = {
  id: 'linux-input',
  version: '1.0.0',
  platform: 'linux',
  format: 'directory',
  signature: { algorithm: 'ECDSA-P256-SHA256', signer: 'test', value: 'signed' },
  files: [{ path: 'adapter.mjs', type: 'file', sizeBytes: 1, integrity: 'sha256-file' }],
  entrypoint: 'adapter.mjs',
};

test('installed adapter runtime verifies pointer, package, platform, and factory before activation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'spartan-adapter-'));
  try {
    const target = join(root, 'linux-input', '1.0.0');
    await mkdir(target, { recursive: true });
    await writeFile(
      join(root, 'linux-input', 'current.json'),
      JSON.stringify({ id: 'linux-input', version: '1.0.0', integrity: 'sha256-file' }),
    );
    await writeFile(join(target, 'manifest.json'), JSON.stringify(manifest));
    const runtime = createInstalledAdapterRuntime({
      installRoot: root,
      id: 'linux-input',
      platform: 'linux',
      verifyManifest: async ({ manifest: value }) => value.signature.signer === 'test',
      loadModule: async () => ({
        createPlatformAdapter: async ({ platform, kind }) => ({ platform, kind, execute() {} }),
      }),
    });
    const loaded = await runtime.load();
    assert.equal(loaded.adapter.platform, 'linux');
    assert.equal((await runtime.inspect()).manifest.entrypoint, 'adapter.mjs');
    const activated = await runtime.createBoundary({
      registry: { get: () => ({ state: 'ready' }), describe: () => ({}) },
      kind: 'input',
    });
    assert.equal(activated.adapter.platform, 'linux');
    await activated.boundary.invoke('input', 'execute', { kind: 'button' });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test('installed adapter runtime fails closed for an unverified manifest', async () => {
  const root = await mkdtemp(join(tmpdir(), 'spartan-adapter-'));
  try {
    const target = join(root, 'linux-input', '1.0.0');
    await mkdir(target, { recursive: true });
    await writeFile(
      join(root, 'linux-input', 'current.json'),
      JSON.stringify({ id: 'linux-input', version: '1.0.0' }),
    );
    await writeFile(join(target, 'manifest.json'), JSON.stringify(manifest));
    const runtime = createInstalledAdapterRuntime({
      installRoot: root,
      id: 'linux-input',
      platform: 'linux',
      verifyManifest: async () => false,
      loadModule: async () => {
        throw new Error('must not load');
      },
    });
    await assert.rejects(() => runtime.load(), /verification failed/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test('installed virtual-gamepad runtime passes bounded activation options to its dedicated factory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'spartan-adapter-'));
  try {
    const virtualManifest = {
      ...manifest,
      id: 'windows-virtual-gamepad',
      kind: 'virtual-gamepad',
      platform: 'win32',
    };
    const target = join(root, virtualManifest.id, virtualManifest.version);
    await mkdir(target, { recursive: true });
    await writeFile(
      join(root, virtualManifest.id, 'current.json'),
      JSON.stringify({
        id: virtualManifest.id,
        version: virtualManifest.version,
        integrity: 'sha256-file',
      }),
    );
    await writeFile(join(target, 'manifest.json'), JSON.stringify(virtualManifest));
    let received;
    const runtime = createInstalledAdapterRuntime({
      installRoot: root,
      id: virtualManifest.id,
      platform: 'win32',
      expectedKind: 'virtual-gamepad',
      verifyManifest: async () => true,
      loadModule: async () => ({
        createVirtualGamepad: async (options) => {
          received = options;
          return { platform: 'win32', kind: 'virtual-gamepad', execute() {} };
        },
      }),
    });
    const loaded = await runtime.load({
      options: { config: { backend: 'Windows external driver', deviceId: 'xinput-1' } },
    });
    assert.equal(loaded.manifest.kind, 'virtual-gamepad');
    assert.equal(received.config.deviceId, 'xinput-1');
    assert.equal(received.platform, 'win32');
    assert.equal(received.kind, 'virtual-gamepad');
    await assert.rejects(() => runtime.createBoundary(), /virtual-gamepad adapters/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test('installed adapter manifest verifier requires a public key and verifies file entries', async () => {
  assert.throws(() => createInstalledAdapterManifestVerifier(), /public key JWK/);
  const verifier = createInstalledAdapterManifestVerifier({
    publicKeyJwk: { kty: 'EC', crv: 'P-256' },
    subtle: {
      async importKey() {
        return 'key';
      },
      async verify() {
        return false;
      },
    },
  });
  assert.equal(await verifier({ manifest, target: '/tmp/adapter' }), false);
});
test('installed emulator runtime resolves a verified package executable', async () => {
  const root = await mkdtemp(join(tmpdir(), 'spartan-emulator-'));
  try {
    const target = join(root, 'dolphin', '1.0.0');
    const emulator = {
      ...manifest,
      id: 'dolphin',
      kind: 'emulator',
      entrypoint: 'bin/dolphin',
      files: [
        { path: 'bin', type: 'directory', sizeBytes: 0 },
        { path: 'bin/dolphin', sizeBytes: 1, integrity: 'sha256-file' },
      ],
    };
    await mkdir(join(target, 'bin'), { recursive: true });
    await writeFile(join(target, 'bin', 'dolphin'), 'x');
    await writeFile(join(root, 'dolphin', 'current.json'), JSON.stringify({ id: 'dolphin', version: '1.0.0' }));
    await writeFile(join(target, 'manifest.json'), JSON.stringify(emulator));
    const runtime = createInstalledEmulatorRuntime({
      installRoot: root,
      id: 'dolphin',
      platform: 'linux',
      verifyManifest: async () => true,
    });
    assert.equal((await runtime.inspect()).entrypoint, join(target, 'bin', 'dolphin'));
    await rm(join(target, 'bin', 'dolphin'));
    await assert.rejects(() => runtime.inspect(), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
