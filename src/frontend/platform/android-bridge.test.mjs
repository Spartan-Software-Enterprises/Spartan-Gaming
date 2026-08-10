import assert from 'node:assert/strict';
import test from 'node:test';
import {ACTIONS, createAndroidBridge, MAX_MESSAGE_BYTES, RESULT_EVENT, normalizeAndroidResult} from './android-bridge.mjs';

test('Android bridge emits versioned policy messages through the optional native surface', () => {
  const messages = [];
  const bridge = createAndroidBridge({idFactory: () => 'and-policy', bridge: {postMessage: value => { messages.push(JSON.parse(value)); return true; }}});
  assert.equal(bridge.available, true);
  assert.deepEqual(bridge.applyPolicy({formFactor: 'phone', orientation: 'landscape'}), {status: 'requested', action: ACTIONS.policy, requestId: 'and-policy', accepted: true});
  assert.deepEqual(messages, [{version: 1, requestId: 'and-policy', action: 'android.policy', payload: {formFactor: 'phone', orientation: 'landscape'}}]);
});

test('Android bridge exposes bounded native requests and fails closed when absent', () => {
  const unavailable = createAndroidBridge({idFactory: () => 'and-missing', bridge: null});
  assert.deepEqual(unavailable.queryGameMode(), {status: 'unavailable', action: ACTIONS.gameMode, requestId: 'and-missing'});
  const messages = [];
  let sequence = 0;
  const bridge = createAndroidBridge({idFactory: () => `and-${++sequence}`, bridge: {postMessage: value => { messages.push(value); }}});
  assert.deepEqual(bridge.requestControllerInventory(), {status: 'requested', action: ACTIONS.controllers, requestId: 'and-1'});
  assert.deepEqual(bridge.requestTextInput({action: 'show', userInitiated: true, hasFocus: true}), {status: 'requested', action: ACTIONS.textInput, requestId: 'and-2'});
  assert.equal(messages.length, 2);
});

test('Android bridge only forwards validated GameNative library handoffs', () => {
  const messages = [];
  const bridge = createAndroidBridge({idFactory: () => 'and-game', bridge: {postMessage: value => { messages.push(JSON.parse(value)); return true; }}});
  assert.deepEqual(bridge.launchGameNative({appId: 12345, store: 'steam'}), {status: 'requested', action: ACTIONS.gameNative, requestId: 'and-game', accepted: true});
  assert.deepEqual(messages[0], {version: 1, requestId: 'and-game', action: 'android.gamenative.launch', payload: {appId: 12345, store: 'STEAM'}});
  assert.equal(bridge.launchGameNative({appId: 0, store: 'STEAM'}).status, 'rejected');
  assert.equal(bridge.launchGameNative({appId: 12345, store: 'URL'}).status, 'rejected');
});

test('Android bridge rejects oversized or malformed native bridge payloads', () => {
  const bridge = createAndroidBridge({idFactory: () => 'and-error', bridge: {postMessage: () => { throw new Error('native rejected'); }}});
  assert.equal(bridge.send('android.policy', {text: 'x'.repeat(MAX_MESSAGE_BYTES)}).status, 'rejected');
  assert.equal(bridge.send('android.unknown').reason, 'unsupported Android bridge action');
  assert.equal(createAndroidBridge({idFactory: () => 'and-nul', bridge: {postMessage: () => { throw new Error('\u0000 bad'); }}}).queryGameMode().reason, 'bridge rejected message');
});

test('Android bridge correlates only valid native result events', () => {
  const listeners = new Map();
  const target = {addEventListener(type, listener) { listeners.set(type, listener); }, removeEventListener(type) { listeners.delete(type); }};
  const sent = [];
  const bridge = createAndroidBridge({idFactory: () => 'and-1', bridge: {postMessage(value) { sent.push(JSON.parse(value)); return true; }}, target});
  assert.equal(bridge.queryGameMode().requestId, 'and-1');
  assert.equal(bridge.pendingCount, 1);
  const results = []; const stop = bridge.listen(result => results.push(result));
  listeners.get(RESULT_EVENT)?.({detail: {version: 1, requestId: 'and-unknown', action: ACTIONS.gameMode, status: 'accepted'}});
  listeners.get(RESULT_EVENT)?.({detail: {version: 1, requestId: 'and-1', action: ACTIONS.policy, status: 'accepted'}});
  listeners.get(RESULT_EVENT)?.({detail: {version: 1, requestId: 'and-1', action: ACTIONS.gameMode, status: 'accepted', payload: {mode: 'Performance'}}});
  listeners.get(RESULT_EVENT)?.({detail: {version: 1, requestId: 'bad id', action: ACTIONS.gameMode, status: 'accepted'}});
  assert.deepEqual(results, [{version: 1, requestId: 'and-1', action: ACTIONS.gameMode, status: 'accepted', payload: {mode: 'Performance'}}]);
  assert.equal(bridge.pendingCount, 0);
  stop(); assert.equal(listeners.size, 0);
  assert.equal(normalizeAndroidResult({version: 1, requestId: 'and-1', action: ACTIONS.gameMode, status: 'pending'}), null);
});
