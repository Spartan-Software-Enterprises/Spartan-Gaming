import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRuntimeProfileStore,
  normalizeRuntimeProfile,
  resolveRuntimeProfile,
} from './runtime-profiles.mjs';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test('runtime profiles validate trusted native metadata without executing paths', () => {
  const profile = normalizeRuntimeProfile({
    id: 'dolphin-linux',
    name: 'Dolphin Linux',
    kind: 'native-emulator',
    platform: 'linux',
    version: '5.0',
    coreIds: ['dolphin'],
    executablePath: '/opt/dolphin/dolphin-emu',
    trust: 'user-approved',
  });
  assert.equal(profile.id, 'dolphin-linux');
  assert.equal(profile.trust, 'user-approved');
  assert.throws(
    () =>
      normalizeRuntimeProfile({
        id: 'remote',
        name: 'Remote',
        kind: 'native-emulator',
        platform: 'linux',
        version: '1',
        executablePath: 'https://example.test/runtime',
      }),
    /local path/,
  );
  assert.throws(
    () =>
      normalizeRuntimeProfile({
        id: 'untrusted',
        name: 'Untrusted',
        kind: 'native-adapter',
        platform: 'linux',
        version: '1',
      }),
    /executablePath/,
  );
});

test('runtime profile store persists only normalized profiles and supports portable export', () => {
  const storage = memoryStorage();
  const store = createRuntimeProfileStore({ storage });
  store.save({
    id: 'libretro-linux',
    name: 'Libretro Linux',
    kind: 'libretro-core',
    platform: 'linux',
    version: '1.18',
    coreIds: ['libretro'],
    trust: 'signed',
  });
  assert.equal(store.list()[0].coreIds[0], 'libretro');
  const restored = createRuntimeProfileStore({ storage: memoryStorage() });
  assert.throws(
    () => restored.import(store.export().replace('"version": 1', '"version": 2')),
    /unsupported/,
  );
  restored.import(store.export());
  assert.equal(restored.get('libretro-linux').trust, 'signed');
});

test('runtime selection reports browser readiness, trusted matches, and missing configuration', () => {
  const profiles = [
    {
      id: 'pcsx2-linux',
      name: 'PCSX2 Linux',
      kind: 'native-emulator',
      platform: 'linux',
      version: '2',
      coreIds: ['pcsx2'],
      executablePath: '/usr/bin/pcsx2-qt',
      trust: 'user-approved',
    },
  ];
  assert.equal(
    resolveRuntimeProfile({
      coreId: 'libretro',
      preference: 'automatic',
      platform: 'browser',
      browserReady: true,
    }).status,
    'ready',
  );
  assert.equal(
    resolveRuntimeProfile({
      coreId: 'pcsx2',
      preference: 'native-adapter',
      platform: 'linux',
      profiles,
    }).profile.id,
    'pcsx2-linux',
  );
  assert.equal(
    resolveRuntimeProfile({
      coreId: 'dolphin',
      preference: 'native-adapter',
      platform: 'linux',
      profiles,
    }).status,
    'configuration-required',
  );
  assert.equal(
    resolveRuntimeProfile({
      coreId: 'libretro',
      preference: 'browser-wasm',
      platform: 'browser',
      browserReady: false,
    }).status,
    'browser-capability-missing',
  );
});
