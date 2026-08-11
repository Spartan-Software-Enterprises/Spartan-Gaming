import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAdapterManagerModel,
  detectAdapterPlatform,
  readAdapterManifestBundle,
} from './manager.mjs';

const signed = {
  id: 'pcsx2',
  version: '1.0.0',
  kind: 'emulator',
  status: 'installed',
  trust: 'signed',
  platforms: ['linux'],
  capabilities: ['video'],
  license: 'GPL-3.0-or-later',
  integrity: 'sha256-pcsx2',
  signature: { algorithm: 'ECDSA-P256-SHA256', signer: 'release', value: 'sig' },
};
test('adapter manager distinguishes browser-capable cores from native adapter readiness', () => {
  const model = createAdapterManagerModel({
    platform: 'linux',
    records: [signed],
    cores: [
      { id: 'libretro', name: 'Libretro', mode: 'browser-or-native' },
      { id: 'pcsx2', name: 'PCSX2', mode: 'native' },
      { id: 'dolphin', name: 'Dolphin', mode: 'native' },
    ],
  });
  assert.equal(model.rows[0].status, 'browser-runtime');
  assert.equal(model.rows[1].status, 'ready');
  assert.equal(model.rows[2].status, 'unavailable');
});
test('adapter manager normalizes manifest bundles and detects desktop platforms', () => {
  assert.equal(readAdapterManifestBundle({ records: [signed] })[0].id, 'pcsx2');
  assert.equal(detectAdapterPlatform('Win32'), 'win32');
  assert.equal(detectAdapterPlatform('MacIntel'), 'darwin');
  assert.equal(detectAdapterPlatform('Linux x86_64'), 'linux');
  assert.equal(detectAdapterPlatform('Android'), 'browser');
});
test('adapter manager rejects malformed manifest bundles', () => {
  assert.throws(() => readAdapterManifestBundle({ records: [{ id: 'broken' }] }), /non-empty/);
  assert.throws(() => readAdapterManifestBundle({ records: 'broken' }), /contain/);
});
