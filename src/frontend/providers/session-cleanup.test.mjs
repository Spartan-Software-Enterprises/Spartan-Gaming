import assert from 'node:assert/strict';
import test from 'node:test';
import {PROVIDER_SESSION_KEYS, clearProviderSessionState} from './session-cleanup.mjs';

test('provider session cleanup removes only Spartan-owned transient handoffs', () => {
  const removed = [];
  const result = clearProviderSessionState({removeItem: key => removed.push(key)});
  assert.deepEqual(removed, PROVIDER_SESSION_KEYS);
  assert.deepEqual(result.removed, PROVIDER_SESSION_KEYS);
  assert.equal(result.officialSignOutRequired, true);
});

test('provider session cleanup degrades safely without session storage', () => {
  assert.deepEqual(clearProviderSessionState(null), {removed: [], officialSignOutRequired: true});
});
