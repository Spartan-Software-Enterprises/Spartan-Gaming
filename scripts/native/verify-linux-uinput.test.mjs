import assert from 'node:assert/strict';
import test from 'node:test';
import { probeLinuxUinput, verifyLinuxUinput } from './verify-linux-uinput.mjs';

test('Linux uinput verifier reports missing device access without claiming readiness', async () => {
  const result = await probeLinuxUinput({
    installRoot: '/external/native-linux',
    accessImpl: async () => {
      throw new Error('denied');
    },
  });
  assert.equal(result.status, 'unavailable');
  assert.match(result.reason, /not readable/);
});

test('Linux uinput verifier can exercise an injected package through the real operation sequence', async () => {
  const calls = [];
  let closed = false;
  const module = {
    createBindings: async () => ({
      capabilities: { gamepad: true, rumble: false },
      input: { execute: async (operation) => calls.push(operation) },
      close() {
        closed = true;
      },
    }),
  };
  const result = await verifyLinuxUinput({
    installRoot: '/external/native-linux',
    accessImpl: async () => {},
    importer: async () => module,
    execute: true,
  });
  assert.equal(result.status, 'ready');
  assert.equal(result.input, 'verified');
  assert.equal(result.forceFeedback, 'not-requested');
  assert.equal(calls.length, 6);
  assert.equal(closed, true);
});

test('Linux uinput verifier reports force-feedback observation failures explicitly', async () => {
  const module = {
    createBindings: async () => ({
      capabilities: { gamepad: true, rumble: true },
      input: { execute: async () => {}, readRumbleEvents: () => [] },
      close() {},
    }),
  };
  const result = await verifyLinuxUinput({
    installRoot: '/external/native-linux',
    accessImpl: async () => {},
    importer: async () => module,
    execute: true,
    rumble: true,
    timeoutMs: 50,
  });
  assert.equal(result.status, 'unavailable');
  assert.equal(result.input, 'failed');
  assert.equal(result.forceFeedback, 'failed');
  assert.match(result.reason, /not observed/);
});
