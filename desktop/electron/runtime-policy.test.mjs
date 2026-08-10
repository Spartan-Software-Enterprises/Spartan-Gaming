import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeElectronRuntimePolicy} from './runtime-policy.mjs';

test('Electron runtime policy defaults to throttling and accepts the explicit performance setting', () => {
  assert.deepEqual(normalizeElectronRuntimePolicy(), {backgroundThrottling: true});
  assert.deepEqual(normalizeElectronRuntimePolicy({backgroundThrottling: false}), {backgroundThrottling: false});
  assert.deepEqual(normalizeElectronRuntimePolicy({backgroundThrottling: 'false'}), {backgroundThrottling: true});
});
