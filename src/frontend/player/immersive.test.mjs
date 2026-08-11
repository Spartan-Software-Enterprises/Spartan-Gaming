import test from 'node:test';
import assert from 'node:assert/strict';
import { createImmersiveController, detectImmersiveCapabilities } from './immersive.mjs';

function fakeDocument() {
  return {
    fullscreenEnabled: true,
    fullscreenElement: null,
    pointerLockElement: null,
    exitFullscreen() {
      this.fullscreenElement = null;
    },
    exitPointerLock() {
      this.pointerLockElement = null;
    },
    addEventListener() {},
    removeEventListener() {},
  };
}

test('immersive capability detection is explicit and safe', () => {
  const documentRef = fakeDocument();
  assert.deepEqual(
    detectImmersiveCapabilities({
      documentRef,
      navigatorRef: { keyboard: { lock() {}, unlock() {} } },
    }),
    { fullscreen: true, pointerLock: true, keyboardLock: true },
  );
  assert.equal(
    detectImmersiveCapabilities({ documentRef: {}, navigatorRef: {} }).fullscreen,
    false,
  );
});

test('immersive controller enters and exits with optional locks', async () => {
  const documentRef = fakeDocument();
  const navigatorRef = {
    keyboard: {
      locked: false,
      lock() {
        this.locked = true;
      },
      unlock() {
        this.locked = false;
      },
    },
  };
  const target = {
    requestFullscreen() {
      documentRef.fullscreenElement = target;
    },
    requestPointerLock() {
      documentRef.pointerLockElement = target;
    },
  };
  const controller = createImmersiveController({ target, documentRef, navigatorRef });
  await controller.enter();
  assert.equal(controller.state, 'active');
  assert.equal(navigatorRef.keyboard.locked, true);
  await controller.exit();
  assert.equal(controller.state, 'inactive');
  assert.equal(navigatorRef.keyboard.locked, false);
  controller.dispose();
});

test('immersive controller tolerates rejected optional Pointer Lock', async () => {
  const documentRef = fakeDocument();
  const target = {
    requestFullscreen() {
      documentRef.fullscreenElement = target;
    },
    requestPointerLock() {
      return Promise.reject(new Error('permission denied'));
    },
  };
  const controller = createImmersiveController({ target, documentRef, navigatorRef: {} });
  await controller.enter();
  assert.equal(controller.state, 'active');
});

test('immersive controller requests the selected Screen Details display and falls back when options are rejected', async () => {
  const documentRef = fakeDocument();
  const calls = [];
  const selectedScreen = { label: 'Display 2' };
  const navigatorRef = {
    getScreenDetails: async () => ({ screens: [{ label: 'Display 1' }, selectedScreen] }),
  };
  const target = {
    requestFullscreen(options) {
      calls.push(options);
      documentRef.fullscreenElement = target;
      if (options) throw new TypeError('screen option unsupported');
    },
  };
  const controller = createImmersiveController({
    target,
    documentRef,
    navigatorRef,
    display: { kind: 'index', index: 1 },
  });
  await controller.enter();
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], { screen: selectedScreen });
  assert.equal(calls[1], undefined);
  controller.dispose();
});

test('immersive controller safely ignores unavailable selected displays', async () => {
  const documentRef = fakeDocument();
  const calls = [];
  const target = {
    requestFullscreen(options) {
      calls.push(options);
      documentRef.fullscreenElement = target;
    },
  };
  const controller = createImmersiveController({
    target,
    documentRef,
    navigatorRef: { getScreenDetails: async () => ({ screens: [] }) },
    display: { kind: 'index', index: 2 },
  });
  await controller.enter();
  assert.deepEqual(calls, [undefined]);
});
