import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createFavoritesStore,
  createRomLibraryStore,
  validRomRecord,
  normalizeRomRecord
} from './library-state.mjs';

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
test('favorites are isolated by workspace and persist safely', () => {
  const backend = storage();
  const gaming = createFavoritesStore({ storage: backend, workspaceId: 'gaming' });
  const family = createFavoritesStore({ storage: backend, workspaceId: 'family' });
  gaming.toggle('xbox-cloud');
  assert.deepEqual(gaming.list(), ['xbox-cloud']);
  assert.deepEqual(family.list(), []);
  assert.equal(gaming.has('xbox-cloud'), true);
});
test('favorites reject malformed ids and bound stored collections', () => {
  const backend = storage();
  const store = createFavoritesStore({ storage: backend, workspaceId: 'guest' });
  assert.throws(
    () => createFavoritesStore({ storage: backend, workspaceId: 'bad space' }),
    /safe profile/,
  );
  store.set(['valid-id', 'not valid', 'valid-id']);
  assert.deepEqual(store.list(), ['valid-id']);
});
test('default workspace migrates the previous unscoped favorites collection', () => {
  const backend = storage();
  backend.setItem('spartan-gaming.favorites.v1', JSON.stringify(['steam', 'xbox-cloud']));
  const store = createFavoritesStore({ storage: backend, workspaceId: 'gaming' });
  assert.deepEqual(store.list(), ['steam', 'xbox-cloud']);
});

test('rom library validates and normalizes records', () => {
  const validRecord = {
    romPath: '/games/SuperMario.smc',
    system: 'snes',
    extension: 'smc',
    name: 'Super Mario',
    mime: 'application/x-snes-rom'
  };
  assert.ok(validRomRecord(validRecord));
  const normalized = normalizeRomRecord(validRecord);
  assert.strictEqual(normalized.romPath, '/games/SuperMario.smc');
  assert.strictEqual(normalized.system, 'snes');
  assert.strictEqual(normalized.extension, 'smc');
});

test('rom library rejects invalid records', () => {
  const invalidRecord = {
    romPath: '/games/SuperMario.smc',
    system: 'snes',
    extension: 'smc',
    name: 'Super Mario'
    // missing mime
  };
  assert.notOk(validRomRecord(invalidRecord));
  assert.throws(() => normalizeRomRecord(invalidRecord), /invalid/);
});

test('rom library stores and retrieves records', () => {
  const backend = storage();
  const store = createRomLibraryStore({ storage: backend, workspaceId: 'gaming' });
  const record = {
    romPath: '/games/Zelda.zip',
    system: 'arcade',
    extension: 'zip',
    name: 'The Legend of Zelda',
    mime: 'application/zip'
  };
  store.add(record);
  const list = store.list();
  assert.strictEqual(list.length, 1);
  assert.deepEqual(list[0], record);
  assert.ok(store.get('/games/Zelda.zip'));
});

test('rom library removes records by path', () => {
  const backend = storage();
  const store = createRomLibraryStore({ storage: backend, workspaceId: 'gaming' });
  store.add({
    romPath: '/games/Metroid.zip',
    system: 'arcade',
    extension: 'zip',
    name: 'Metroid',
    mime: 'application/zip'
  });
  store.add({
    romPath: '/games/Mario.smc',
    system: 'snes',
    extension: 'smc',
    name: 'Super Mario',
    mime: 'application/x-snes-rom'
  });
  assert.strictEqual(store.list().length, 2);
  assert.ok(store.remove('/games/Metroid.zip'));
  assert.strictEqual(store.list().length, 1);
  assert.strictEqual(store.list()[0].romPath, '/games/Mario.smc');
  assert.notOk(store.remove('/games/NonExistent.nes'));
});

test('rom library searches by name, system, and extension', () => {
  const backend = storage();
  const store = createRomLibraryStore({ storage: backend, workspaceId: 'gaming' });
  store.add({
    romPath: '/games/Contra.zip',
    system: 'arcade',
    extension: 'zip',
    name: 'Contra',
    mime: 'application/zip'
  });
  store.add({
    romPath: '/games/Mario.smc',
    system: 'snes',
    extension: 'smc',
    name: 'Super Mario',
    mime: 'application/x-snes-rom'
  });
  let results = store.find('mario');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].name, 'Super Mario');
  results = store.find('arcade');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].system, 'arcade');
  results = store.find('.smc');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].extension, 'smc');
});

test('rom library imports from paths and applies system detection', () => {
  const backend = storage();
  const store = createRomLibraryStore({ storage: backend, workspaceId: 'gaming' });
  const results = store.importFromPaths([
    '/games/Pokemon.gba',
    '/games/Link.smc',
    '/games/Tetris.nes'
  ]);
  assert.strictEqual(results.length, 3);
  assert.strictEqual(results[0].system, 'gba');
  assert.strictEqual(results[0].extension, 'gba');
  assert.strictEqual(results[1].system, 'snes');
  assert.strictEqual(results[1].extension, 'smc');
  assert.strictEqual(results[2].system, 'nes');
  assert.strictEqual(results[2].extension, 'nes');
  const list = store.list();
  assert.strictEqual(list.length, 3);
});

test('rom library clears storage', () => {
  const backend = storage();
  const store = createRomLibraryStore({ storage: backend, workspaceId: 'gaming' });
  store.add({
    romPath: '/games/Test.zip',
    system: 'arcade',
    extension: 'zip',
    name: 'Test Game',
    mime: 'application/zip'
  });
  assert.strictEqual(store.list().length, 1);
  store.clear();
  assert.strictEqual(store.list().length, 0);
});
