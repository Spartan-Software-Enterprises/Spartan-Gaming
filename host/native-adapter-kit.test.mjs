import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPlatformNativeAdapter,
  getPlatformNativeAdapterSpec,
} from './native-adapter-kit.mjs';

test('native adapter kit exposes platform-specific capture, audio, and input contracts', () => {
  for (const platform of ['win32', 'darwin', 'linux'])
    for (const kind of ['capture', 'audio', 'input']) {
      const spec = getPlatformNativeAdapterSpec(platform, kind);
      assert.equal(spec.platform, platform);
      assert.equal(spec.kind, kind);
      assert.ok(spec.technology);
      assert.ok(spec.permission);
      assert.ok(spec.operations.length);
    }
});
test('native adapter kit delegates only the declared operations and preserves platform identity', async () => {
  const calls = [];
  const adapter = createPlatformNativeAdapter({
    platform: 'linux',
    kind: 'input',
    bindings: {
      execute: async (operation) => calls.push(operation),
      close: () => calls.push('close'),
    },
  });
  await adapter.execute({ kind: 'button' });
  adapter.close();
  assert.equal(adapter.id, 'linux-native-input');
  assert.deepEqual(calls, [{ kind: 'button' }, 'close']);
});
test('native adapter kit fails closed for missing or mismatched bindings', () => {
  assert.throws(
    () => createPlatformNativeAdapter({ platform: 'win32', kind: 'input', bindings: {} }),
    /bindings.execute/,
  );
  assert.throws(
    () =>
      createPlatformNativeAdapter({
        platform: 'android',
        kind: 'input',
        bindings: { execute() {} },
      }),
    /unsupported/,
  );
  assert.throws(() => getPlatformNativeAdapterSpec('linux', 'webrtc'), /unsupported/);
});
