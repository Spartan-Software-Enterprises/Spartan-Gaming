import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeAndroidControllerInventory } from './android-controller.mjs';

test('Android controller inventory is bounded and keeps only approved metadata', () => {
  const result = normalizeAndroidControllerInventory([
    {
      deviceId: 7,
      name: 'Deck pad',
      vendorId: 1,
      productId: 2,
      capabilities: ['haptics', 'motion', 'secret'],
    },
  ]);
  assert.deepEqual(result, {
    count: 1,
    multipleControllers: false,
    devices: [
      {
        slot: 0,
        deviceId: 7,
        name: 'Deck pad',
        vendorId: 1,
        productId: 2,
        capabilities: ['haptics', 'motion'],
      },
    ],
  });
  assert.equal(
    normalizeAndroidControllerInventory([{ deviceId: 1 }, { deviceId: 2 }]).multipleControllers,
    true,
  );
});

test('Android controller inventory fails closed for malformed records', () => {
  const result = normalizeAndroidControllerInventory([
    { deviceId: 'bad', name: 'x\nunsafe', vendorId: -1, productId: 'bad' },
  ]);
  assert.deepEqual(result.devices[0], {
    slot: 0,
    deviceId: 0,
    name: 'Android controller',
    vendorId: 0,
    productId: 0,
    capabilities: [],
  });
  assert.throws(() => normalizeAndroidControllerInventory(null), /array/);
});
