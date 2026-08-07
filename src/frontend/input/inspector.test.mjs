import test from 'node:test';
import assert from 'node:assert/strict';
import {detectInputCapabilities, inspectGamepad, listApprovedHidDevices} from './inspector.mjs';

test('gamepad inspector reports normalized controls and haptics', () => { const snapshot = inspectGamepad({id: 'Test pad', index: 0, mapping: 'standard', buttons: [{pressed: true, value: 1}], axes: [-0.8], vibrationActuators: [{}], batteryLevel: 0.75}); assert.equal(snapshot.buttons[0].pressed, true); assert.ok(snapshot.axes[0] < 0); assert.equal(snapshot.haptics, true); assert.equal(snapshot.batteryLevel, 0.75); });
test('input capability detection handles browser API absence', () => { assert.deepEqual(detectInputCapabilities({navigatorRef: {}}), {gamepad: false, hid: false, vibration: false}); });
test('approved HID devices are reduced to stable device metadata', async () => { const devices = await listApprovedHidDevices({navigatorRef: {hid: {getDevices: async () => [{productName: 'Wheel', vendorId: 10, productId: 20, opened: true}]}}}); assert.deepEqual(devices, [{productName: 'Wheel', vendorId: 10, productId: 20, opened: true}]); });
