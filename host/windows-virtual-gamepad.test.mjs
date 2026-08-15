import assert from 'node:assert/strict';
import test from 'node:test';
import { createVirtualGamepad } from './windows-virtual-gamepad.mjs';

test('Windows virtual gamepad fails closed without an injected driver binding', () => {
  assert.throws(() => createVirtualGamepad({ platform: 'win32' }), /binding is unavailable/);
});

test('Windows virtual gamepad delegates supported operations to its binding', () => {
  const calls = [];
  let closed = false;
  const adapter = createVirtualGamepad({
    platform: 'win32',
    binding: {
      execute(operation) {
        calls.push(operation);
        return true;
      },
      close() {
        closed = true;
      },
    },
  });
  assert.equal(adapter.execute({ kind: 'button', code: 1 }), true);
  assert.equal(adapter.execute({ kind: 'unknown' }), false);
  assert.deepEqual(calls, [{ kind: 'button', code: 1 }]);
  assert.equal(adapter.capabilities.state, 'ready');
  adapter.close();
  assert.equal(closed, true);
});
