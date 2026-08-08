import assert from 'node:assert/strict';
import test from 'node:test';
import {createNativeInputExecutor} from './input.mjs';

test('native input executor dispatches only permissioned normalized operations', async () => {
  const operations = []; const executor = createNativeInputExecutor({platform: 'linux', permissions: {'remote-input': true}, adapter: {platform: 'linux', execute: async operation => operations.push(operation)}});
  const plan = await executor.dispatch({type: 'input.event', action: 'look', kind: 'pointer', x: 1.4, y: -0.2, deltaX: 9000, source: 'pointer'});
  assert.equal(plan.permission.granted, true); assert.deepEqual(operations, [{kind: 'pointer', action: 'look', pressed: false, value: 0, control: 'look', x: 1, y: 0, deltaX: 4096, deltaY: 0, gamepadIndex: 0, durationMs: 0, startDelay: 0, strongMagnitude: 0, weakMagnitude: 0}]); assert.equal(executor.state, 'active');
});

test('native input executor fails closed without permission and does not call the adapter', async () => {
  let calls = 0; const executor = createNativeInputExecutor({platform: 'win32', adapter: {platform: 'win32', execute: async () => { calls += 1; }}});
  await assert.rejects(() => executor.dispatch({type: 'input.event', action: 'confirm', kind: 'key', control: 'KeyA', pressed: true, source: 'keyboard'}), /permission not granted/); assert.equal(calls, 0); assert.equal(executor.state, 'ready');
});

test('native input executor rejects an ungranted gamepad event without poisoning later dispatch', async () => {
  let calls = 0; const executor = createNativeInputExecutor({platform: 'darwin', permissions: {'remote-input': true}, adapter: {platform: 'darwin', execute: async () => { calls += 1; }}});
  await assert.rejects(() => executor.dispatch({type: 'input.event', action: 'a', kind: 'button', control: 'a', pressed: true, source: 'gamepad'}), /permission not granted/);
  assert.equal(calls, 0); assert.equal(executor.state, 'ready');
  const plan = await executor.dispatch({type: 'input.event', action: 'look', kind: 'pointer', x: 1, y: 0, deltaX: 2, deltaY: -2, source: 'pointer'});
  assert.equal(plan.permission.granted, true); assert.equal(calls, 1); assert.equal(executor.state, 'active');
});

test('native input executor drops unsupported operations without poisoning later dispatch', async () => {
  let calls = 0; const executor = createNativeInputExecutor({platform: 'linux', permissions: {'remote-input': true}, adapter: {platform: 'linux', execute: async operation => { calls += 1; if (operation.control === 'IntlRo') { const error = new Error('unsupported key'); error.code = 'ERR_UNSUPPORTED_INPUT'; throw error; } }}});
  const dropped = await executor.dispatch({type: 'input.event', action: 'key:IntlRo', kind: 'key', control: 'IntlRo', pressed: true, source: 'keyboard'});
  assert.equal(dropped.unsupported, true); assert.equal(dropped.reason, 'unsupported key'); assert.equal(dropped.permission.granted, true); assert.equal(executor.state, 'active');
  const plan = await executor.dispatch({type: 'input.event', action: 'key:KeyA', kind: 'key', control: 'KeyA', pressed: true, source: 'keyboard'});
  assert.equal(plan.unsupported, undefined); assert.equal(calls, 2); assert.equal(executor.state, 'active');
});

test('native input executor bounds dispatch rate and closes the adapter', async () => {
  let now = 0; let closed = 0; let calls = 0; const executor = createNativeInputExecutor({platform: 'darwin', permissions: {'virtual-gamepad': true}, maxEventsPerSecond: 2, clock: () => now, adapter: {platform: 'darwin', execute: async () => { calls += 1; }, close: () => { closed += 1; }}});
  await executor.dispatch({type: 'input.event', action: 'a', kind: 'button', control: 'a', pressed: true, source: 'gamepad'}); await executor.dispatch({type: 'input.event', action: 'b', kind: 'button', control: 'b', pressed: true, source: 'gamepad'}); await assert.rejects(() => executor.dispatch({type: 'input.event', action: 'c', kind: 'button', control: 'c', pressed: true, source: 'gamepad'}), /rate limit/); assert.equal(calls, 2);
  now = 1000; await executor.dispatch({type: 'input.event', action: 'c', kind: 'button', control: 'c', pressed: true, source: 'gamepad'}); executor.close(); executor.close(); assert.equal(calls, 3); assert.equal(closed, 1); assert.equal(executor.state, 'closed');
});
