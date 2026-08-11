import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBrowserEmulatorAdapterRegistry,
  discoverBrowserEmulatorAdapters,
} from './browser-adapters.mjs';
const adapter = {
  id: 'test-wasm',
  load() {},
  start() {},
  stop() {},
  supports: (core) => core.id === 'libretro',
};
test('browser adapter registry validates, lists, and resolves adapters', () => {
  const registry = createBrowserEmulatorAdapterRegistry([adapter]);
  assert.equal(registry.list()[0], adapter);
  assert.equal(registry.resolve('libretro'), adapter);
  assert.equal(registry.resolve('dolphin'), null);
});
test('browser adapter discovery reads only the explicit Chromium injection point', () => {
  assert.deepEqual(
    discoverBrowserEmulatorAdapters({ __SPARTAN_BROWSER_EMULATOR_ADAPTERS__: [adapter] }),
    [adapter],
  );
  assert.deepEqual(discoverBrowserEmulatorAdapters({}), []);
});
test('browser adapter registry rejects incomplete adapters and duplicates', () => {
  assert.throws(() => createBrowserEmulatorAdapterRegistry([{ id: 'bad' }]), /provide load/);
  const registry = createBrowserEmulatorAdapterRegistry([adapter]);
  assert.throws(() => registry.register(adapter), /already registered/);
});
