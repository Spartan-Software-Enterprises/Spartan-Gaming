import test from 'node:test';
import assert from 'node:assert/strict';

test('multiplayer store creates and lists sessions', async () => {
  const backend = new Map();
  const storage = {
    getItem: (key) => backend.get(key) || null,
    setItem: (key, value) => backend.set(key, value),
    removeItem: (key) => backend.delete(key),
  };
  const { createMultiplayerStore } = await import('./multiplayer.mjs');
  const store = createMultiplayerStore({ storage });

  const session = store.addSession({
    name: 'Test Session',
    game: 'Test Game',
    maxPlayers: 4,
    players: [{ id: 'you', name: 'You', host: true }],
    host: 'You',
    description: 'Test',
  });

  assert.ok(session.id);
  assert.strictEqual(session.name, 'Test Session');
  assert.strictEqual(store.getSessions().length, 1);
});

test('multiplayer store updates and removes sessions', async () => {
  const backend = new Map();
  const storage = {
    getItem: (key) => backend.get(key) || null,
    setItem: (key, value) => backend.set(key, value),
    removeItem: (key) => backend.delete(key),
  };
  const { createMultiplayerStore } = await import('./multiplayer.mjs');
  const store = createMultiplayerStore({ storage });

  const session = store.addSession({ name: 'Test', game: 'Game', maxPlayers: 2 });
  const updated = store.updateSession(session.id, { status: 'in-progress' });
  assert.strictEqual(updated.status, 'in-progress');

  const removed = store.removeSession(session.id);
  assert.strictEqual(removed, true);
  assert.strictEqual(store.getSessions().length, 0);
});

test('multiplayer store manages invitations', async () => {
  const backend = new Map();
  const storage = {
    getItem: (key) => backend.get(key) || null,
    setItem: (key, value) => backend.set(key, value),
    removeItem: (key) => backend.delete(key),
  };
  const { createMultiplayerStore } = await import('./multiplayer.mjs');
  const store = createMultiplayerStore({ storage });

  store.addInvitation({ from: 'Alice', game: 'Game', sessionId: '123' });
  const invitations = store.getInvitations();
  assert.strictEqual(invitations.length, 1);
  assert.strictEqual(invitations[0].status, 'pending');

  store.updateInvitation(invitations[0].id, { status: 'accepted' });
  assert.strictEqual(store.getInvitations()[0].status, 'accepted');
});
