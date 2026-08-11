import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectInputCapabilities,
  inspectGamepad,
  listApprovedHidDevices,
  readInspectableGamepads,
  resolveControllerPreferences,
  selectInspectableGamepads,
} from './inspector.mjs';

test('gamepad inspector reports normalized controls and haptics', () => {
  const snapshot = inspectGamepad({
    id: 'Test pad',
    index: 0,
    mapping: 'standard',
    buttons: [{ pressed: true, value: 1 }],
    axes: [-0.8],
    vibrationActuators: [{}],
    batteryLevel: 0.75,
  });
  assert.equal(snapshot.buttons[0].pressed, true);
  assert.ok(snapshot.axes[0] < 0);
  assert.equal(snapshot.haptics, true);
  assert.equal(snapshot.batteryLevel, 0.75);
});
test('input capability detection handles browser API absence', () => {
  assert.deepEqual(detectInputCapabilities({ navigatorRef: {} }), {
    gamepad: false,
    hid: false,
    vibration: false,
  });
});
test('approved HID devices are reduced to stable device metadata', async () => {
  const devices = await listApprovedHidDevices({
    navigatorRef: {
      hid: {
        getDevices: async () => [
          { productName: 'Wheel', vendorId: 10, productId: 20, opened: true },
        ],
      },
    },
  });
  assert.deepEqual(devices, [{ productName: 'Wheel', vendorId: 10, productId: 20, opened: true }]);
});
test('controller preferences normalize explicit profile, permissions, HID, and advanced controls', () => {
  const preferences = resolveControllerPreferences({
    'controllers.defaultProfile': 'DualSense Edge',
    'controllers.allowGamepad': false,
    'controllers.allowHid': true,
    'controllers.multipleControllers': false,
    'controllers.playerSlots': '8',
    'controllers.inputMode': 'DirectInput',
    'controllers.virtualGamepadBackend': 'Linux uinput',
    'controllers.hapticsBackend': 'Native rumble',
    'controllers.rumble': false,
    'controllers.adaptiveTriggers': true,
    'controllers.gyro': true,
    'controllers.touchpad': true,
    'controllers.backButtons': true,
    'controllers.triggerMode': 'Analog only',
    'controllers.steeringRange': 1080,
    'controllers.splitInput': true,
    'controllers.inputLatency': 'High frequency',
  });
  assert.deepEqual(preferences, {
    defaultProfile: 'DualSense Edge',
    allowGamepad: false,
    allowHid: true,
    multipleControllers: false,
    playerSlots: 8,
    inputMode: 'DirectInput',
    glyphStyle: 'Automatic',
    virtualGamepadBackend: 'Linux uinput',
    hapticsBackend: 'Native rumble',
    rumble: false,
    adaptiveTriggers: true,
    gyro: true,
    touchpad: true,
    trackpads: false,
    backButtons: true,
    touchscreen: false,
    textEntry: true,
    controllerNavigation: true,
    triggerMode: 'Analog only',
    steeringRange: 1080,
    splitInput: true,
    deadzone: 0.08,
    inputPolling: 'High frequency',
  });
  assert.equal(resolveControllerPreferences().defaultProfile, 'Auto-detect');
  assert.equal(resolveControllerPreferences().allowGamepad, true);
  assert.equal(resolveControllerPreferences().rumble, true);
});
test('controller tester inventory enforces permission, multiplayer, and player-slot settings', () => {
  const gamepads = [{ index: 0 }, null, { index: 2 }, { index: 3 }];
  assert.deepEqual(selectInspectableGamepads(gamepads, { allowGamepad: false }), []);
  assert.deepEqual(
    selectInspectableGamepads(gamepads, { multipleControllers: false, playerSlots: 8 }),
    [{ index: 0 }],
  );
  assert.deepEqual(
    selectInspectableGamepads(gamepads, { multipleControllers: true, playerSlots: 2 }),
    [{ index: 0 }, { index: 2 }],
  );
});
test('disabled gamepad access does not evaluate the browser inventory API', () => {
  let calls = 0;
  const navigatorRef = {
    getGamepads() {
      calls += 1;
      throw new Error('gamepad inventory must not be read');
    },
  };
  assert.deepEqual(
    readInspectableGamepads({ navigatorRef, preferences: { allowGamepad: false } }),
    [],
  );
  assert.equal(calls, 0);
});
test('controller tester preferences expose the configured normalized dead zone', () => {
  assert.equal(resolveControllerPreferences({ 'controllers.deadzone': 25 }).deadzone, 0.25);
  assert.equal(resolveControllerPreferences({ 'controllers.deadzone': 99 }).deadzone, 0.3);
});
test('controller preferences accept every Electron profile option', () => {
  assert.equal(
    resolveControllerPreferences({ 'controllers.defaultProfile': 'Nintendo layout' })
      .defaultProfile,
    'Nintendo layout',
  );
  assert.equal(
    resolveControllerPreferences({ 'controllers.defaultProfile': 'Racing wheel and pedals' })
      .defaultProfile,
    'Racing wheel and pedals',
  );
});
