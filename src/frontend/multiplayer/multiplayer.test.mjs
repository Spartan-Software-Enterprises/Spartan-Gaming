import test from 'node:test';
import assert from 'node:assert/strict';

test('multiplayer page loads imported games from localStorage', async () => {
  const backend = new Map();
  backend.set('spartan-gaming.imported-games.v1', JSON.stringify([
    { id: 'game-1', name: 'Test Game 1' },
    { id: 'game-2', name: 'Test Game 2' },
  ]));
  const storage = {
    getItem: (key) => backend.get(key) || null,
    setItem: (key, value) => backend.set(key, value),
    removeItem: (key) => backend.delete(key),
  };
  const { createMultiplayerStore } = await import('./multiplayer.mjs');
  const store = createMultiplayerStore({ storage });

  store.addSession({
    name: 'Test Session',
    game: 'Test Game 1',
    maxPlayers: 4,
    players: [{ id: 'you', name: 'You', host: true }],
    host: 'You',
    description: 'Test',
  });

  assert.strictEqual(store.getSessions().length, 1);
  assert.strictEqual(store.getSessions()[0].game, 'Test Game 1');
});

test('multiplayer store bounds sessions to 100 entries', async () => {
  const backend = new Map();
  const storage = {
    getItem: (key) => backend.get(key) || null,
    setItem: (key, value) => backend.set(key, value),
    removeItem: (key) => backend.delete(key),
  };
  const { createMultiplayerStore } = await import('./multiplayer.mjs');
  const store = createMultiplayerStore({ storage });

  for (let i = 0; i < 150; i++) {
    store.addSession({ name: `Session ${i}`, game: `Game ${i}`, maxPlayers: 4 });
  }
  assert.strictEqual(store.getSessions().length, 100);
});

test('multiplayer store bounds invitations to 200 entries', async () => {
  const backend = new Map();
  const storage = {
    getItem: (key) => backend.get(key) || null,
    setItem: (key, value) => backend.set(key, value),
    removeItem: (key) => backend.delete(key),
  };
  const { createMultiplayerStore } = await import('./multiplayer.mjs');
  const store = createMultiplayerStore({ storage });

  for (let i = 0; i < 250; i++) {
    store.addInvitation({ from: `User${i}`, game: `Game ${i}`, sessionId: `session-${i}` });
  }
  assert.strictEqual(store.getInvitations().length, 200);
});
