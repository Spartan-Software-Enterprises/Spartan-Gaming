import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAndroidBack } from './back-navigation.mjs';

test('Android back closes the topmost open dialog before navigating away', () => {
  let closed = 0;
  const dialog = { close: () => (closed += 1) };
  assert.equal(handleAndroidBack({ querySelectorAll: () => [dialog] }), true);
  assert.equal(closed, 1);
});

test('Android back reports unhandled when the page has no open dialog', () => {
  assert.equal(handleAndroidBack({ querySelectorAll: () => [] }), false);
});
