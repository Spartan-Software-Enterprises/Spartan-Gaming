import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveProviderStartupPolicy } from './startup-policy.mjs';

test('provider startup policy keeps health checks and prewarming independently configurable', () => {
  assert.deepEqual(resolveProviderStartupPolicy(), {
    healthChecks: false,
    prewarmProviders: false,
    shouldProbe: false,
  });
  assert.deepEqual(resolveProviderStartupPolicy({ 'providers.healthChecks': true }), {
    healthChecks: true,
    prewarmProviders: false,
    shouldProbe: true,
  });
  assert.deepEqual(resolveProviderStartupPolicy({ 'performance.prewarmProviders': true }), {
    healthChecks: false,
    prewarmProviders: true,
    shouldProbe: true,
  });
});
