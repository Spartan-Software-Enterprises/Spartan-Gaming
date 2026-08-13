import test from 'node:test';
import assert from 'node:assert/strict';
import { createImportedGameStore } from './library-state.mjs';

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test('imported game store adds and lists games', () => {
  const backend = storage();
  const store = createImportedGameStore({ storage: backend });

  const game = store.add({
    name: 'Test Game',
    providerId: 'steam-library',
    appId: '12345',
    deepLink: 'steam://run/12345',
    storeUrl: 'https://store.steampowered.com/app/12345',
    genres: ['RPG'],
  });

  assert.strictEqual(game.id, 'steam-library:12345');
  assert.strictEqual(game.name, 'Test Game');
  assert.strictEqual(store.list().length, 1);
});

test('imported game store deduplicates by providerId and appId', () => {
  const backend = storage();
  const store = createImportedGameStore({ storage: backend });

  store.add({ name: 'Game A', providerId: 'steam-library', appId: '1' });
  store.add({ name: 'Game A', providerId: 'steam-library', appId: '1' });
  store.add({ name: 'Game B', providerId: 'steam-library', appId: '2' });

  assert.strictEqual(store.list().length, 2);
});

test('imported game store removes by id', () => {
  const backend = storage();
  const store = createImportedGameStore({ storage: backend });

  const game = store.add({ name: 'Game A', providerId: 'steam-library', appId: '1' });
  assert.strictEqual(store.remove(game.id), true);
  assert.strictEqual(store.list().length, 0);
});

test('imported game store finds by provider', () => {
  const backend = storage();
  const store = createImportedGameStore({ storage: backend });

  store.add({ name: 'Game A', providerId: 'steam-library', appId: '1' });
  store.add({ name: 'Game B', providerId: 'gog-library', appId: '2' });

  const steamGames = store.findByProvider('steam-library');
  assert.strictEqual(steamGames.length, 1);
  assert.strictEqual(steamGames[0].name, 'Game A');
});

test('imported game store normalizes and validates records', () => {
  const backend = storage();
  const store = createImportedGameStore({ storage: backend });

  assert.throws(() => store.add({ name: 'No provider' }), /invalid imported game record/);
  assert.throws(() => store.add({ name: 'Bad', providerId: 'steam-library' }), /invalid imported game record/);
  assert.throws(() => store.add({ name: 'Bad', providerId: 'steam-library', appId: 'bad id!' }), /safe identifier/);
});

test('imported game store bounds to 500 entries', () => {
  const backend = storage();
  const store = createImportedGameStore({ storage: backend });

  for (let i = 0; i < 600; i++) {
    store.add({ name: `Game ${i}`, providerId: 'steam-library', appId: String(i) });
  }
  assert.strictEqual(store.list().length, 500);
});

test('imported game store clears storage', () => {
  const backend = storage();
  const store = createImportedGameStore({ storage: backend });

  store.add({ name: 'Game A', providerId: 'steam-library', appId: '1' });
  store.clear();
  assert.strictEqual(store.list().length, 0);
});
