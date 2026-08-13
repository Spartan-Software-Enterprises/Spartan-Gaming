import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserEmulatorInputBridge } from './browser-input.mjs';

function target() {
  const listeners = new Map();
  return {
    navigator: { getGamepads: () => [] },
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
    setInterval() {
      return 1;
    },
    clearInterval() {},
    dispatch(type, event) {
      listeners.get(type)?.(event);
    },
  };
}
test('browser emulator input bridge maps keyboard press and release events', async () => {
  const events = [];
  const runtime = {
    state: 'running',
    input: (event) => {
      events.push(event);
      return Promise.resolve();
    },
  };
  const host = target();
  const bridge = createBrowserEmulatorInputBridge({ runtime, target: host });
  bridge.start();
  let prevented = 0;
  host.dispatch('keydown', {
    code: 'Enter',
    preventDefault: () => {
      prevented += 1;
    },
  });
  host.dispatch('keyup', {
    code: 'Enter',
    preventDefault: () => {
      prevented += 1;
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(
    events.map((event) => [event.action, event.pressed, event.source]),
    [
      ['confirm', true, 'keyboard'],
      ['confirm', false, 'keyboard'],
    ],
  );
  assert.equal(prevented, 2);
  bridge.close();
  assert.equal(bridge.active, false);
});
test('browser emulator input bridge emits gamepad button and axis transitions', async () => {
  const events = [];
  const pad = { id: 'Pad', index: 0, buttons: [{ pressed: true, value: 1 }], axes: [-0.8] };
  const host = target();
  host.navigator.getGamepads = () => [pad];
  const runtime = {
    state: 'running',
    input: (event) => {
      events.push(event);
      return Promise.resolve();
    },
  };
  const bridge = createBrowserEmulatorInputBridge({ runtime, target: host });
  bridge.poll();
  pad.buttons[0] = { pressed: false, value: 0 };
  pad.axes[0] = 0;
  bridge.poll();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(
    events.map((event) => [event.action, event.pressed]),
    [
      ['confirm', true],
      ['moveLeft', true],
      ['confirm', false],
      ['moveLeft', false],
    ],
  );
  bridge.close();
});
test('browser emulator input bridge does not send input while stopped', async () => {
  const events = [];
  const host = target();
  const runtime = {
    state: 'idle',
    input: (event) => {
      events.push(event);
    },
  };
  const bridge = createBrowserEmulatorInputBridge({ runtime, target: host });
  bridge.start();
  host.dispatch('keydown', { code: 'Enter', preventDefault() {} });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(events.length, 0);
  bridge.close();
});
test('browser emulator input bridge leaves keyboard events alone until the runtime canvas has focus', async () => {
  const events = [];
  const canvas = {};
  const host = target();
  host.document = { activeElement: null };
  const runtime = {
    state: 'running',
    input: (event) => {
      events.push(event);
    },
  };
  const bridge = createBrowserEmulatorInputBridge({ runtime, target: host, canvas });
  let prevented = 0;
  bridge.start();
  host.dispatch('keydown', { code: 'Enter', preventDefault() { prevented += 1; } });
  host.document.activeElement = canvas;
  host.dispatch('keydown', { code: 'Enter', preventDefault() { prevented += 1; } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(prevented, 1);
  assert.equal(events.length, 1);
  bridge.close();
});
