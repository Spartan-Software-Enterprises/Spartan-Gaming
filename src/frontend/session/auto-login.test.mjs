import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUTO_LOGIN_KEY,
  AUTO_LOGIN_TTL_MS,
  clearAutoLoginHandoff,
  createAutoLoginHandoff,
  readAutoLoginHandoff,
  saveAutoLoginHandoff,
  shouldRememberAutoLogin,
} from './auto-login.mjs';

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    values,
  };
}

const now = Date.parse('2026-08-12T12:00:00.000Z');
const valid = {
  endpoint: 'wss://signaling.example.test/session',
  sessionId: 'ses-123',
  ticket: 'tkt-456',
  backendId: 'spartan-host',
  backendType: 'remote-play',
  backendName: 'Living Room PC',
  hostId: 'host-1',
};

test('auto-login handoff bounds and requires the authenticated connection fields', () => {
  const handoff = createAutoLoginHandoff(valid, now);
  assert.equal(handoff.version, 1);
  assert.equal(handoff.endpoint, valid.endpoint);
  assert.equal(handoff.sessionId, 'ses-123');
  assert.equal(handoff.ticket, 'tkt-456');
  assert.equal(handoff.backendName, 'Living Room PC');
  assert.equal(handoff.createdAt, now);
  assert.equal(handoff.expiresAt, now + AUTO_LOGIN_TTL_MS);
  assert.equal(createAutoLoginHandoff({ ...valid, sessionId: '' }, now), null);
  assert.equal(createAutoLoginHandoff({ ...valid, ticket: '' }, now), null);
  assert.equal(createAutoLoginHandoff({ ...valid, endpoint: 'http://insecure.test' }, now), null);
  assert.equal(createAutoLoginHandoff({ ...valid, expiresAt: now - 1000 }, now), null);
  const legacy = createAutoLoginHandoff(valid, 'invalid');
  assert.ok(legacy);
  assert.ok(legacy.expiresAt <= Date.now() + AUTO_LOGIN_TTL_MS);
});

test('auto-login handoff rejects oversized and non-string input', () => {
  assert.equal(createAutoLoginHandoff({ ...valid, ticket: 'x'.repeat(5000) }, now), null);
  assert.equal(createAutoLoginHandoff({ ...valid, sessionId: 42 }, now), null);
  assert.equal(createAutoLoginHandoff({ ...valid, endpoint: { nested: true } }, now), null);
});

test('auto-login handoff persists to the local app profile and expires on read', () => {
  const store = storage();
  assert.equal(saveAutoLoginHandoff(store, valid, now), true);
  assert.equal(store.getItem(AUTO_LOGIN_KEY).includes('ses-123'), true);
  const handoff = readAutoLoginHandoff(store, now + 1000);
  assert.equal(handoff.sessionId, 'ses-123');
  assert.equal(readAutoLoginHandoff(store, now + AUTO_LOGIN_TTL_MS + 1000), null);
  assert.equal(store.values.has(AUTO_LOGIN_KEY), false);
});

test('auto-login handoff fails closed on malformed stored data', () => {
  const store = storage();
  assert.equal(readAutoLoginHandoff(store), null);
  store.setItem(AUTO_LOGIN_KEY, '{bad json');
  assert.equal(readAutoLoginHandoff(store), null);
  store.setItem(AUTO_LOGIN_KEY, JSON.stringify({ ...valid, sessionId: '' }));
  assert.equal(readAutoLoginHandoff(store), null);
  store.setItem(AUTO_LOGIN_KEY, JSON.stringify({ ...valid, expiresAt: now - 5000 }));
  assert.equal(readAutoLoginHandoff(store, now), null);
});

test('auto-login handoff can be cleared explicitly', () => {
  const store = storage();
  saveAutoLoginHandoff(store, valid, now);
  assert.equal(clearAutoLoginHandoff(store), true);
  assert.equal(readAutoLoginHandoff(store, now), null);
  assert.equal(clearAutoLoginHandoff(null), false);
  assert.equal(saveAutoLoginHandoff(null, valid, now), false);
});

test('auto-login eligibility requires explicit opt-in and an authenticated connection', () => {
  assert.equal(
    shouldRememberAutoLogin({
      enabled: true,
      authenticated: true,
      context: { backendId: 'spartan-host', hostId: 'host-1' },
    }),
    true,
  );
  assert.equal(shouldRememberAutoLogin({ enabled: true, authenticated: true }), false);
  assert.equal(
    shouldRememberAutoLogin({ enabled: true, authenticated: false, context: { hostId: 'h' } }),
    false,
  );
  assert.equal(
    shouldRememberAutoLogin({ enabled: false, authenticated: true, context: { hostId: 'h' } }),
    false,
  );
});
