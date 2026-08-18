import test from 'node:test';
import assert from 'node:assert/strict';
import { nextConsoleMode, resolveConsoleMode } from './console-mode.mjs';
test('console mode is always enabled', () => {
  assert.equal(resolveConsoleMode({ settings: {}, deviceMode: 'desktop' }), true);
  assert.equal(resolveConsoleMode({ settings: {}, deviceMode: 'television' }), true);
  assert.equal(resolveConsoleMode({ settings: {}, deviceMode: 'handheld' }), true);
});
test('console mode toggle always returns true', () => {
  assert.equal(nextConsoleMode(false), true);
  assert.equal(nextConsoleMode(true), true);
});
