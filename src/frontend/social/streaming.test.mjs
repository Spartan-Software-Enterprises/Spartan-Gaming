import test from 'node:test';
import assert from 'node:assert/strict';

test('streaming module exposes supported service ids', async () => {
  const { setupStreamServices } = await import('./streaming.mjs');
  assert.strictEqual(typeof setupStreamServices, 'function');
});
