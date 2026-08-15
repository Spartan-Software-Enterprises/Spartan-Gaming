import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBluetoothManager,
  createBluetoothPairingRequest,
  createBluetoothReconnectPlan,
  normalizeBluetoothDevice,
  normalizeBluetoothPairingResult,
  normalizeBluetoothSnapshot,
} from './bluetooth.mjs';

const controller = (overrides = {}) => ({
  id: 'opaque-controller-1',
  name: 'Gamepad',
  kind: 'controller',
  transport: 'ble',
  paired: true,
  connected: false,
  battery: 101,
  capabilities: { hid: true, rumble: true, battery: true },
  ...overrides,
});

test('normalizes Bluetooth capabilities and clamps battery without retaining addresses', () => {
  const device = normalizeBluetoothDevice({ ...controller(), address: 'AA:BB:CC:DD:EE:FF' });
  assert.equal(device.battery, 100);
  assert.equal(device.capabilities.hid, true);
  assert.equal(device.capabilities.rumble, true);
  assert.equal('address' in device, false);
  assert.equal(Object.isFrozen(device), true);
});

test('discovery is bounded and de-duplicates opaque identifiers', () => {
  const result = normalizeBluetoothSnapshot([controller(), controller({ name: 'duplicate' })]);
  assert.equal(result.length, 1);
  assert.throws(
    () =>
      normalizeBluetoothSnapshot(
        Array.from({ length: 65 }, (_, index) => controller({ id: `device-${index}` })),
      ),
    /limited/,
  );
});

test('pairing requires explicit consent and preserves the requested device id', () => {
  assert.throws(() => createBluetoothPairingRequest({ deviceId: 'controller' }), /consent/);
  assert.deepEqual(createBluetoothPairingRequest({ deviceId: 'controller', consent: true }), {
    deviceId: 'controller',
    consent: true,
  });
  assert.deepEqual(normalizeBluetoothPairingResult({ status: 'paired' }, 'controller'), {
    deviceId: 'controller',
    status: 'paired',
  });
  assert.throws(
    () => normalizeBluetoothPairingResult({ deviceId: 'other', status: 'paired' }, 'controller'),
    /mismatch/,
  );
});

test('reconnect is fail-closed for unpaired devices and bounded for approved devices', () => {
  assert.deepEqual(
    createBluetoothReconnectPlan({ device: controller({ paired: false }), permission: true }),
    { allowed: false, attempts: 0, deviceId: 'opaque-controller-1' },
  );
  assert.deepEqual(createBluetoothReconnectPlan({ device: controller(), permission: true }), {
    allowed: true,
    attempts: 3,
    deviceId: 'opaque-controller-1',
  });
  assert.throws(
    () => createBluetoothReconnectPlan({ device: controller(), permission: true, maxAttempts: 4 }),
    /1 to 3/,
  );
});

test('manager delegates only normalized, consented operations to native adapter', async () => {
  const calls = [];
  const manager = createBluetoothManager({
    platform: 'linux',
    permission: true,
    adapter: {
      async discover() {
        return [controller()];
      },
      async pair(request) {
        calls.push(['pair', request]);
        return { status: 'paired' };
      },
      async connect(request) {
        calls.push(['connect', request]);
        return { status: 'connected' };
      },
      async forget(request) {
        calls.push(['forget', request]);
      },
    },
  });
  assert.equal((await manager.discover())[0].kind, 'controller');
  await manager.pair('opaque-controller-1');
  await manager.reconnect(controller());
  await manager.forget('opaque-controller-1');
  assert.deepEqual(calls, [
    ['pair', { deviceId: 'opaque-controller-1', consent: true }],
    ['connect', { deviceId: 'opaque-controller-1' }],
    ['forget', { deviceId: 'opaque-controller-1' }],
  ]);
});
