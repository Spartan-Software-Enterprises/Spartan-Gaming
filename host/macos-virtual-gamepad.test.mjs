import assert from 'node:assert/strict';
import test from 'node:test';
import { createVirtualGamepad } from './macos-virtual-gamepad.mjs';

test('macOS virtual gamepad fails closed without an injected driver binding', () => {
  assert.throws(() => createVirtualGamepad({ platform: 'darwin' }), /binding is unavailable/);
});

test('macOS virtual gamepad delegates supported operations to its binding', () => {
  const calls = [];
  const adapter = createVirtualGamepad({
    platform: 'darwin',
    binding: { execute: (operation) => (calls.push(operation), true) },
  });
  assert.equal(adapter.execute({ kind: 'rumble', strongMagnitude: 0.5 }), true);
  assert.equal(adapter.execute({ kind: 'unknown' }), false);
  assert.deepEqual(calls, [{ kind: 'rumble', strongMagnitude: 0.5 }]);
  assert.equal(adapter.capabilities.state, 'ready');
});
