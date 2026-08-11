import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPlatformNativeAdapter, loadPlatformNativeBindings } from './native-binding-loader.mjs';

function moduleFor(platform) {
  return {
    createBindings: async () => ({
      platform,
      capabilities: { capture: true, audio: true, input: true },
      input: { execute: async () => {}, close() {} },
      capture: { start: async () => {}, stop: async () => {} },
      audio: { start: async () => {}, stop: async () => {} },
    }),
  };
}
test('native binding loader selects an optional platform package and composes its input adapter', async () => {
  const result = await loadPlatformNativeAdapter({
    platform: 'linux',
    kind: 'input',
    packageName: '@test/linux',
    loader: async (name) => {
      assert.equal(name, '@test/linux');
      return moduleFor('linux');
    },
  });
  assert.equal(result.status, 'available');
  assert.equal(result.adapter.platform, 'linux');
  await result.adapter.execute({ kind: 'button' });
});
test('native binding loader reports missing packages without falling back', async () => {
  const result = await loadPlatformNativeBindings({
    platform: 'darwin',
    packageName: '@test/macos',
    loader: async () => {
      const error = new Error('missing');
      error.code = 'ERR_MODULE_NOT_FOUND';
      throw error;
    },
  });
  assert.deepEqual(result, {
    status: 'unavailable',
    platform: 'darwin',
    packageName: '@test/macos',
    reason: 'native package is not installed',
  });
});
test('native binding loader fails closed for malformed package exports', async () => {
  const result = await loadPlatformNativeAdapter({
    platform: 'win32',
    kind: 'capture',
    packageName: '@test/windows',
    loader: async () => ({ createBindings: async () => ({ platform: 'win32', capabilities: {} }) }),
  });
  assert.equal(result.status, 'unavailable');
  assert.match(result.reason, /capture/);
});
