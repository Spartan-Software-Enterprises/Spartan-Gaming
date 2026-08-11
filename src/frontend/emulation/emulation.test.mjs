import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  computeSelectedFileSha256,
  createEmulationLaunchPlan,
  createEmulationLibraryIndex,
  createEmulationLibraryStore,
  createUserFileRecord,
  formatFileSize,
  resolveEmulationPreferences,
} from './emulation.mjs';
import './browser-runtime.test.mjs';
import './browser-adapters.test.mjs';
import './browser-input.test.mjs';

const core = {
  id: 'dolphin',
  mode: 'native',
  systems: ['gamecube', 'wii'],
  license: 'GPL-2.0-or-later',
};
test('emulation library preserves directory paths across metadata persistence', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
  const store = createEmulationLibraryStore({ storage });
  store.add([
    createUserFileRecord(
      { name: 'game.iso', relativePath: 'zelda/game.iso', size: 100 },
      { kind: 'game' },
    ),
  ]);
  const restored = createEmulationLibraryStore({ storage });
  assert.equal(restored.list()[0].relativePath, 'zelda/game.iso');
});
test('user file records preserve selection metadata without file contents', () => {
  const record = createUserFileRecord({ name: 'game.iso', size: 1024, lastModified: 10 });
  assert.equal(record.extension, 'iso');
  assert.equal(record.userSelected, true);
  assert.equal(record.content, undefined);
});
test('selected browser files retain an ephemeral source without making it enumerable', () => {
  const source = {
    name: 'game.rom',
    size: 32,
    lastModified: 4,
    async arrayBuffer() {
      return new ArrayBuffer(0);
    },
  };
  const record = createUserFileRecord(source);
  assert.equal(record.source, source);
  assert.equal(Object.keys(record).includes('source'), false);
  assert.equal(JSON.stringify(record).includes('arrayBuffer'), false);
});
test('selected firmware can be hashed without persisting its source bytes', async () => {
  const bytes = new TextEncoder().encode('Spartan firmware');
  const source = {
    name: 'bios.bin',
    size: bytes.byteLength,
    async arrayBuffer() {
      return bytes;
    },
  };
  const record = createUserFileRecord(source, { kind: 'firmware' });
  const digest = await computeSelectedFileSha256(record, { cryptoImpl: webcrypto });
  const withDigest = createUserFileRecord(record, { kind: 'firmware', sha256: digest });
  assert.equal(
    withDigest.sha256,
    '826cac61972e4d4105558cb1fd99164548d81b21fb2a8add10f6d9d657a3c7b5',
  );
  assert.equal(withDigest.source, source);
  assert.equal(JSON.stringify(withDigest).includes('source'), false);
});
test('firmware hashing rejects unselected or oversized content', async () => {
  await assert.rejects(
    () => computeSelectedFileSha256({ name: 'bios.bin', size: 1, userSelected: false }),
    /explicitly selected/,
  );
  await assert.rejects(
    () =>
      computeSelectedFileSha256(
        {
          name: 'bios.bin',
          size: 10,
          userSelected: true,
          source: { arrayBuffer: async () => new ArrayBuffer(0) },
        },
        { maxBytes: 1 },
      ),
    /too large/,
  );
});
test('library index deduplicates selected files', () => {
  const file = { name: 'game.rom', size: 100 };
  assert.equal(createEmulationLibraryIndex([file, file]).length, 1);
});
test('directory-selected files retain a bounded relative path for duplicate game names', () => {
  const first = createUserFileRecord({
    name: 'game.iso',
    webkitRelativePath: 'zelda/game.iso',
    size: 100,
  });
  const second = createUserFileRecord({
    name: 'game.iso',
    webkitRelativePath: 'mario/game.iso',
    size: 100,
  });
  assert.notEqual(first.id, second.id);
  assert.equal(first.relativePath, 'zelda/game.iso');
});
test('emulation library persists metadata without file contents or launch authority', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
  const store = createEmulationLibraryStore({ storage });
  const record = createUserFileRecord(
    { name: 'game.iso', size: 200, lastModified: 12 },
    { kind: 'game' },
  );
  store.add([record]);
  assert.equal(store.list()[0].name, 'game.iso');
  assert.equal(store.list()[0].userSelected, false);
  assert.equal(store.list()[0].content, undefined);
  const restored = createEmulationLibraryStore({ storage });
  assert.equal(restored.list().length, 1);
  assert.throws(
    () => createEmulationLaunchPlan({ core, gameFile: restored.list()[0] }),
    /selected/,
  );
});
test('emulation library can retain a firmware digest but never its selected source', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
  const source = {
    name: 'bios.bin',
    size: 2,
    async arrayBuffer() {
      return new Uint8Array([1, 2]);
    },
  };
  const record = createUserFileRecord(source, { kind: 'firmware', sha256: 'a'.repeat(64) });
  const store = createEmulationLibraryStore({ storage });
  store.add([record]);
  assert.equal(store.list()[0].sha256, 'a'.repeat(64));
  assert.equal(store.list()[0].source, undefined);
  assert.equal(JSON.parse(values.get('spartan-gaming.emulation-library.v1'))[0].source, undefined);
});
test('emulation library removes remembered metadata safely', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
  const store = createEmulationLibraryStore({ storage });
  const record = createUserFileRecord({ name: 'game.rom', size: 20 }, { kind: 'game' });
  store.add([record]);
  assert.equal(store.remove(record.id).length, 0);
});
test('launch plans require legal user-selected game and firmware files', () => {
  const plan = createEmulationLaunchPlan({
    core,
    gameFile: { name: 'game.iso', size: 10 },
    firmwareFiles: [{ name: 'bios.bin', size: 2 }],
  });
  assert.equal(plan.status, 'ready');
  assert.deepEqual(
    plan.files.map((file) => file.kind),
    ['game', 'firmware'],
  );
  assert.equal(plan.policy.shipRoms, false);
});
test('launch plans fail closed for missing license or unselected content', () => {
  assert.throws(
    () =>
      createEmulationLaunchPlan({ core: { ...core, license: '' }, gameFile: { name: 'game.iso' } }),
    /license/,
  );
  assert.throws(
    () => createEmulationLaunchPlan({ core, gameFile: { name: 'game.iso', userSelected: false } }),
    /selected/,
  );
});
test('launch plans require firmware when the selected runtime declares it', () => {
  const pcsx2 = {
    id: 'pcsx2',
    mode: 'native',
    systems: ['playstation-2'],
    license: 'GPL-3.0-or-later',
  };
  assert.throws(
    () => createEmulationLaunchPlan({ core: pcsx2, gameFile: { name: 'game.iso' } }),
    /firmware/,
  );
});
test('file sizes are human-readable', () => {
  assert.equal(formatFileSize(1024 ** 2), '1.0 MB');
});
test('emulation preferences translate runtime and graphics settings into bounded adapter options', () => {
  const result = resolveEmulationPreferences({
    'emulation.frontend': 'Spartan runtime',
    'emulation.renderer': 'Metal',
    'emulation.scanLibraries': false,
    'emulation.autoSaveStates': false,
    'emulation.cloudSaves': true,
    'emulation.saveLocation': 'Game folder',
    'emulation.integerScaling': false,
    'emulation.vsync': false,
    'emulation.shaderPreset': 'CRT scanlines',
    'emulation.rewind': true,
    'emulation.netplay': true,
    'performance.webgpu': false,
    'performance.webAssemblyThreads': false,
  });
  assert.deepEqual(result, {
    preference: 'spartan-runtime',
    renderer: 'Metal',
    allowWebGpu: false,
    allowWebAssemblyThreads: false,
    scanLibraries: false,
    autoSaveStates: false,
    cloudSaves: true,
    saveLocation: 'Game folder',
    integerScaling: false,
    vsync: false,
    shaderPreset: 'CRT scanlines',
    rewind: true,
    netplay: true,
  });
  assert.equal(
    resolveEmulationPreferences({ 'emulation.shaderPreset': 'unsupported' }).shaderPreset,
    'Sharp bilinear',
  );
});
