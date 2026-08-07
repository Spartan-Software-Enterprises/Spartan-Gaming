import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdapterRegistry, createSessionEnvelope, createSessionManager, negotiateCapabilities} from './session.mjs';

test('capability negotiation selects compatible transport and codecs', () => {
  const result = negotiateCapabilities({transports: ['websocket', 'webrtc'], video: {codecs: ['h264'], maxWidth: 1920, maxHeight: 1080, maxFramerate: 60}, audio: {codecs: ['opus'], channels: 2}}, {transports: ['webrtc'], video: {codecs: ['av1', 'h264'], maxWidth: 1280, maxHeight: 720, maxFramerate: 30}, audio: {codecs: ['opus'], channels: 1}});
  assert.deepEqual(result.transports, ['webrtc']); assert.equal(result.video.codec, 'h264'); assert.equal(result.video.maxWidth, 1280); assert.equal(result.audio.channels, 1);
});

test('capability negotiation rejects incompatible sessions', () => {
  assert.throws(() => negotiateCapabilities({transports: ['webrtc'], video: {codecs: ['av1']}, audio: {codecs: ['opus']}}, {transports: ['websocket'], video: {codecs: ['h264']}, audio: {codecs: ['aac']}}), /transport/);
});

test('session manager follows offer, answer, and close lifecycle', () => {
  const manager = createSessionManager({idFactory: () => 'ses-test-01', clock: () => '2026-08-07T12:00:00.000Z'});
  const backend = {id: 'spartan-host', backendType: 'provider'};
  const offer = manager.start({backend});
  assert.equal(manager.state, 'negotiating'); assert.equal(offer.type, 'session.offer'); assert.equal(offer.sessionId, 'ses-test-01'); assert.equal(offer.payload.quality.type, 'quality.request');
  manager.receive(createSessionEnvelope({sessionId: offer.sessionId, type: 'telemetry.health', payload: {packetLossPct: 9}})); assert.equal(manager.quality.id, 'low');
  assert.equal(manager.receive(createSessionEnvelope({sessionId: offer.sessionId, type: 'session.answer', payload: {accepted: true}})), 'connected');
  const reconnect = manager.requestReconnect();
  assert.equal(manager.state, 'reconnecting'); assert.equal(reconnect.type, 'session.reconnect'); assert.equal(reconnect.payload.attempt, 1); assert.equal(manager.recovery.attempt, 1);
  manager.receive(createSessionEnvelope({sessionId: offer.sessionId, type: 'session.answer', payload: {accepted: true}, sequence: reconnect.sequence + 1}));
  assert.equal(manager.state, 'connected'); assert.equal(manager.recovery.attempt, 0);
  assert.equal(manager.close(), 'closed'); assert.throws(() => manager.receive({sessionId: offer.sessionId, type: 'session.answer'}), /transition/);
});

test('adapter registry rejects duplicate ids and returns immutable adapters', () => {
  const registry = createAdapterRegistry([{id: 'web-provider', kind: 'provider', modes: ['web']}]);
  assert.equal(registry.get('web-provider').kind, 'provider'); assert.throws(() => registry.register({id: 'web-provider'}), /duplicate/); assert.equal(Object.isFrozen(registry.get('web-provider')), true);
});
