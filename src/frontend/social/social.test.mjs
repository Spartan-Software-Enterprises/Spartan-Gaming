import test from 'node:test';
import assert from 'node:assert/strict';
import { createSocialStore } from './social.mjs';

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test('social store persists friends, messages, parties, and presence', () => {
  const backend = storage();
  const store = createSocialStore({ storage: backend });

  store.setFriends([{ id: 'friend-1', name: 'Alice', status: 'online' }]);
  store.addMessage({ with: 'friend-1', from: 'you', text: 'Hi' });
  store.setParties([{ id: 'party-1', name: 'Gaming Party', open: true, members: ['friend-1'] }]);
  store.setPresence({ status: 'online', activity: 'Zelda' });

  assert.deepEqual(store.getFriends(), [{ id: 'friend-1', name: 'Alice', status: 'online' }]);
  assert.strictEqual(store.getMessages().length, 1);
  assert.strictEqual(store.getMessages()[0].text, 'Hi');
  assert.deepEqual(store.getParties(), [
    { id: 'party-1', name: 'Gaming Party', open: true, members: ['friend-1'] },
  ]);
  assert.strictEqual(store.getPresence().status, 'online');
  assert.strictEqual(store.getPresence().activity, 'Zelda');
});

test('social store defaults to empty collections', () => {
  const backend = storage();
  const store = createSocialStore({ storage: backend });

  assert.deepEqual(store.getFriends(), []);
  assert.deepEqual(store.getMessages(), []);
  assert.deepEqual(store.getParties(), []);
  assert.strictEqual(store.getPresence().status, 'online');
});

test('social store messages are bounded to 500 entries', () => {
  const backend = storage();
  const store = createSocialStore({ storage: backend });

  for (let i = 0; i < 600; i++) {
    store.addMessage({ with: 'friend-1', from: 'you', text: `msg-${i}` });
  }
  assert.strictEqual(store.getMessages().length, 500);
});
