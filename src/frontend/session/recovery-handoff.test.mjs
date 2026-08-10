import test from 'node:test';
import assert from 'node:assert/strict';
import {clearSessionRecoveryHandoff, createSessionRecoveryHandoff, readSessionRecoveryHandoff, saveSessionRecoveryHandoff, SESSION_RECOVERY_KEY, SESSION_RECOVERY_TTL_MS} from './recovery-handoff.mjs';

function storage() {
  const values = new Map();
  return {getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key)};
}

test('session recovery handoff is bounded, authenticated, and session scoped', () => {
  const store = storage();
  assert.equal(saveSessionRecoveryHandoff(store, {endpoint: 'wss://signal.example.test/connect', sessionId: 'ses-1', ticket: 'ticket-1', backendId: 'host', backendType: 'remote-play', backendName: 'Living room host'}, 1000), true);
  const handoff = readSessionRecoveryHandoff(store, 1001);
  assert.equal(handoff.endpoint, 'wss://signal.example.test/connect');
  assert.equal(handoff.ticket, 'ticket-1');
  assert.equal(handoff.expiresAt, 1000 + SESSION_RECOVERY_TTL_MS);
  assert.equal(JSON.parse(store.getItem(SESSION_RECOVERY_KEY)).version, 1);
});

test('session recovery expires and is removed', () => {
  const store = storage();
  saveSessionRecoveryHandoff(store, {endpoint: 'ws://localhost:8787', sessionId: 'ses-2', ticket: 'ticket-2'}, 2000);
  assert.equal(readSessionRecoveryHandoff(store, 2000 + SESSION_RECOVERY_TTL_MS), null);
  assert.equal(store.getItem(SESSION_RECOVERY_KEY), null);
});

test('session recovery rejects malformed or unsafe connection data', () => {
  assert.equal(createSessionRecoveryHandoff({endpoint: 'https://signal.example.test', sessionId: 'ses', ticket: 'ticket'}, 1000), null);
  assert.equal(createSessionRecoveryHandoff({endpoint: 'wss://signal.example.test', sessionId: 'ses', ticket: 'ticket', expiresAt: 1000 + SESSION_RECOVERY_TTL_MS + 1}, 1000), null);
  const store = storage();
  store.setItem(SESSION_RECOVERY_KEY, '{not-json');
  assert.equal(readSessionRecoveryHandoff(store, 1000), null);
  assert.equal(clearSessionRecoveryHandoff(store), true);
});
