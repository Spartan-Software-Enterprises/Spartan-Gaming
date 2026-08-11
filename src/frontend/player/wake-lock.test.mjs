import assert from 'node:assert/strict';
import test from 'node:test';
import { createWakeLockController } from './wake-lock.mjs';

function fakeDocument() {
  const listeners = new Map();
  return {
    visibilityState: 'visible',
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: (type, listener) => {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    emit: (type) => listeners.get(type)?.(),
  };
}

test('wake lock acquires, releases, and can reacquire after visibility changes', async () => {
  const documentRef = fakeDocument();
  const sentinels = [];
  const navigatorRef = {
    wakeLock: {
      request: async () => {
        const listeners = new Map();
        const sentinel = {
          released: false,
          addEventListener: (type, listener) => listeners.set(type, listener),
          removeEventListener: (type, listener) => {
            if (listeners.get(type) === listener) listeners.delete(type);
          },
          release: async () => {
            sentinel.released = true;
            listeners.get('release')?.();
          },
        };
        sentinels.push(sentinel);
        return sentinel;
      },
    },
  };
  const states = [];
  const controller = createWakeLockController({
    navigatorRef,
    documentRef,
    onState: (state) => states.push(state),
  });
  assert.equal(await controller.start(), true);
  assert.equal(controller.state, 'active');
  await sentinels[0].release();
  assert.equal(controller.state, 'released');
  documentRef.emit('visibilitychange');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sentinels.length, 2);
  assert.equal(controller.state, 'active');
  await controller.stop();
  assert.equal(controller.state, 'disabled');
  assert.equal(sentinels[1].released, true);
  assert.deepEqual(states, ['active', 'released', 'active', 'disabled']);
  controller.close();
});

test('wake lock fails closed when unsupported or denied', async () => {
  const unsupported = createWakeLockController({ navigatorRef: {}, documentRef: fakeDocument() });
  assert.equal(await unsupported.start(), false);
  assert.equal(unsupported.state, 'unsupported');
  const denied = createWakeLockController({
    navigatorRef: {
      wakeLock: {
        request: async () => {
          throw new Error('denied');
        },
      },
    },
    documentRef: fakeDocument(),
  });
  assert.equal(await denied.start(), false);
  assert.equal(denied.state, 'unavailable');
});
