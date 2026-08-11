import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPlatformAdapterBoundary,
  createPlatformAdapterRegistry,
} from './platform-adapters.mjs';

test('platform adapter registry exposes all universal desktop capability boundaries', () => {
  const registry = createPlatformAdapterRegistry({ platform: 'linux' });
  assert.equal(registry.list()[0].id, 'linux-native');
  assert.deepEqual(Object.keys(registry.describe().adapters).sort(), [
    'audio',
    'capture',
    'input',
    'packaging',
    'windowing',
  ]);
  assert.equal(registry.get('input').technology, 'uinput');
});
test('platform adapter registry fails closed for unsupported platforms and kinds', () => {
  assert.equal(createPlatformAdapterRegistry({ platform: 'android' }).list().length, 0);
  assert.throws(
    () => createPlatformAdapterRegistry({ platform: 'linux' }).get('gpu'),
    /unsupported/,
  );
});
test('platform adapter registry promotes only runtime-discovered native boundaries', () => {
  const registry = createPlatformAdapterRegistry({
    platform: 'win32',
    capabilities: { keyboard: true, pointer: true, rumble: true },
  });
  assert.equal(registry.get('input').state, 'ready');
  assert.equal(registry.get('capture').state, 'planned');
  assert.equal(registry.get('audio').state, 'planned');
});
test('platform adapter boundary requires ready matching implementations', async () => {
  const registry = createPlatformAdapterRegistry({
    platform: 'linux',
    adapters: [
      {
        id: 'test-linux',
        platform: 'linux',
        adapters: {
          capture: { technology: 'test', state: 'ready' },
          audio: { technology: 'test', state: 'unavailable' },
          input: { technology: 'test', state: 'unavailable' },
          windowing: { technology: 'test', state: 'unavailable' },
          packaging: { technology: 'test', state: 'unavailable' },
        },
      },
    ],
  });
  const calls = [];
  const boundary = createPlatformAdapterBoundary({
    platform: 'linux',
    registry,
    implementations: {
      capture: {
        start: (value) => {
          calls.push(value);
          return 'started';
        },
      },
    },
  });
  assert.equal(await boundary.invoke('capture', 'start', 'session'), 'started');
  assert.deepEqual(calls, ['session']);
  await assert.rejects(() => boundary.invoke('audio', 'start'), /not ready/);
});
