import assert from 'node:assert/strict';
import test from 'node:test';
import {ACTIONS, createAndroidBridge, MAX_MESSAGE_BYTES} from './android-bridge.mjs';

test('Android bridge emits versioned policy messages through the optional native surface', () => {
  const messages = [];
  const bridge = createAndroidBridge({bridge: {postMessage: value => { messages.push(JSON.parse(value)); return true; }}});
  assert.equal(bridge.available, true);
  assert.deepEqual(bridge.applyPolicy({formFactor: 'phone', orientation: 'landscape'}), {status: 'requested', action: ACTIONS.policy, accepted: true});
  assert.deepEqual(messages, [{version: 1, action: 'android.policy', payload: {formFactor: 'phone', orientation: 'landscape'}}]);
});

test('Android bridge exposes bounded native requests and fails closed when absent', () => {
  const unavailable = createAndroidBridge({bridge: null});
  assert.deepEqual(unavailable.queryGameMode(), {status: 'unavailable', action: ACTIONS.gameMode});
  const messages = [];
  const bridge = createAndroidBridge({bridge: {postMessage: value => { messages.push(value); }}});
  assert.deepEqual(bridge.requestControllerInventory(), {status: 'requested', action: ACTIONS.controllers});
  assert.deepEqual(bridge.requestTextInput({action: 'show', userInitiated: true, hasFocus: true}), {status: 'requested', action: ACTIONS.textInput});
  assert.equal(messages.length, 2);
});

test('Android bridge rejects oversized or malformed native bridge payloads', () => {
  const bridge = createAndroidBridge({bridge: {postMessage: () => { throw new Error('native rejected'); }}});
  assert.equal(bridge.send('android.policy', {text: 'x'.repeat(MAX_MESSAGE_BYTES)}).status, 'rejected');
  assert.equal(createAndroidBridge({bridge: {postMessage: () => { throw new Error('\u0000 bad'); }}}).queryGameMode().reason, 'bridge rejected message');
});
