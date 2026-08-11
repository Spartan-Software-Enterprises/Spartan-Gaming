import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInputInjectionPlan,
  inputAdapterIsReady,
  normalizeInputAdapterCapabilities,
} from './input.mjs';

test('input adapter capabilities fail closed before native permissions and adapters exist', () => {
  const capabilities = normalizeInputAdapterCapabilities({ platform: 'linux' });
  assert.equal(capabilities.state, 'unconfigured');
  assert.equal(capabilities.adapter, 'linux-uinput');
  assert.equal(inputAdapterIsReady(capabilities), false);
});

test('input injection plans cover keyboard, pointer, gamepad, and rumble without shell execution', () => {
  const keyboard = createInputInjectionPlan({
    platform: 'win32',
    event: {
      type: 'input.event',
      kind: 'key',
      source: 'keyboard',
      action: 'confirm',
      control: 'Enter',
      pressed: true,
    },
    permissions: { 'remote-input': true },
  });
  assert.equal(keyboard.operation.kind, 'key');
  assert.equal(keyboard.permission.granted, true);
  assert.equal(keyboard.ready, false);
  assert.equal(keyboard.requires.includes('native-input-adapter'), true);
  const pointer = createInputInjectionPlan({
    platform: 'linux',
    event: {
      type: 'input.event',
      kind: 'pointer',
      source: 'pointer',
      action: 'look',
      x: 2,
      y: -1,
      deltaX: 9000,
    },
    permissions: { 'remote-input': true },
  });
  assert.equal(pointer.operation.x, 1);
  assert.equal(pointer.operation.y, 0);
  assert.equal(pointer.operation.deltaX, 4096);
  const rumble = createInputInjectionPlan({
    platform: 'darwin',
    event: {
      type: 'input.event',
      kind: 'rumble',
      source: 'host',
      action: 'rumble',
      gamepadIndex: 4,
      durationMs: 9000,
      startDelay: -1,
      strongMagnitude: 2,
      weakMagnitude: -1,
    },
  });
  assert.equal(rumble.permission.name, 'haptic-output');
  assert.equal(rumble.operation.durationMs, 5000);
  assert.equal(rumble.operation.gamepadIndex, 4);
  assert.equal(rumble.operation.startDelay, 0);
  assert.equal(rumble.operation.strongMagnitude, 1);
  assert.equal(rumble.operation.weakMagnitude, 0);
});

test('unsupported input platforms fail closed', () => {
  assert.throws(
    () =>
      createInputInjectionPlan({
        platform: 'android',
        event: { type: 'input.event', action: 'jump' },
      }),
    /unsupported input platform/,
  );
});

test('gamepad events require the virtual-gamepad permission and are denied without it', () => {
  const event = {
    type: 'input.event',
    kind: 'button',
    source: 'gamepad',
    action: 'button-12',
    control: 'button-12',
    pressed: true,
  };
  const granted = createInputInjectionPlan({
    platform: 'linux',
    event,
    permissions: { 'virtual-gamepad': true },
  });
  assert.equal(granted.permission.name, 'virtual-gamepad');
  assert.equal(granted.permission.granted, true);
  const denied = createInputInjectionPlan({
    platform: 'linux',
    event,
    permissions: { 'virtual-gamepad': false },
  });
  assert.equal(denied.permission.granted, false);
  const unattached = createInputInjectionPlan({ platform: 'linux', event, permissions: {} });
  assert.equal(unattached.permission.granted, false);
});
