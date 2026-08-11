import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeReadiness } from './runtime.mjs';

const cloud = {
  id: 'cloud',
  backendType: 'provider',
  capabilities: ['gamepad'],
  requirements: ['provider-account'],
};
const host = {
  id: 'host',
  backendType: 'provider',
  capabilities: ['gamepad'],
  requirements: ['user-owned-host'],
  integrationModes: ['self-hosted'],
};

test('runtime readiness preserves catalog blockers and recommends diagnostics', () => {
  const result = createRuntimeReadiness({ entry: cloud, report: { input: { gamepad: false } } });
  assert.equal(result.status, 'browser-capability-missing');
  assert.equal(result.nextAction, 'run-diagnostics');
  assert.deepEqual(result.blocking, ['browser:gamepad', 'configuration:provider-account']);
  assert.equal(Object.isFrozen(result.layers), true);
});

test('runtime readiness adds host preflight as a separate layer', () => {
  const result = createRuntimeReadiness({
    entry: host,
    report: { input: { gamepad: true } },
    hostCapabilities: {
      media: { capture: true, encode: true, transports: ['websocket'] },
      publisher: { state: 'unconfigured' },
    },
    clientTransports: ['webrtc'],
  });
  assert.equal(result.status, 'host-not-ready');
  assert.equal(result.nextAction, 'configure-host');
  assert.ok(result.blocking.includes('host:publisher'));
  assert.equal(result.layers.host.status, 'configuration-required');
});

test('runtime readiness fails closed for untrusted native adapters', () => {
  const entry = {
    id: 'emu',
    backendType: 'emulator',
    mode: 'browser-or-native',
    capabilities: [],
    requirements: [],
  };
  const result = createRuntimeReadiness({ entry, adapter: { status: 'blocked' } });
  assert.equal(result.status, 'adapter-trust-required');
  assert.equal(result.nextAction, 'choose-runtime');
  assert.deepEqual(result.blocking, ['adapter:trust']);
});

test('runtime readiness accepts a fully ready browser path', () => {
  const result = createRuntimeReadiness({
    entry: { ...cloud, requirements: [] },
    report: { input: { gamepad: true } },
  });
  assert.equal(result.status, 'ready');
  assert.equal(result.nextAction, 'launch');
  assert.deepEqual(result.blocking, []);
});
