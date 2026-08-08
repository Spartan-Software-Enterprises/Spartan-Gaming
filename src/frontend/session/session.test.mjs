import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdapterRegistry, createSessionEnvelope, createSessionManager, negotiateCapabilities, normalizeCapabilities} from './session.mjs';

test('capability negotiation selects compatible transport and codecs', () => {
  const result = negotiateCapabilities({transports: ['websocket', 'webrtc'], video: {codecs: ['h264'], maxWidth: 1920, maxHeight: 1080, maxFramerate: 60}, audio: {codecs: ['opus'], channels: 2}}, {transports: ['webrtc'], video: {codecs: ['av1', 'h264'], maxWidth: 1280, maxHeight: 720, maxFramerate: 30}, audio: {codecs: ['opus'], channels: 1}});
  assert.deepEqual(result.transports, ['webrtc']); assert.equal(result.video.codec, 'h264'); assert.equal(result.video.maxWidth, 1280); assert.equal(result.audio.channels, 1);
});

test('capability negotiation rejects incompatible sessions', () => {
  assert.throws(() => negotiateCapabilities({transports: ['webrtc'], video: {codecs: ['av1']}, audio: {codecs: ['opus']}}, {transports: ['websocket'], video: {codecs: ['h264']}, audio: {codecs: ['aac']}}), /transport/);
});

test('capability normalization rejects malformed remote limits', () => {
  assert.throws(() => normalizeCapabilities({video: {maxWidth: Number.NaN}}), /video.maxWidth/);
  assert.throws(() => normalizeCapabilities({video: {maxFramerate: 241}}), /video.maxFramerate/);
  assert.throws(() => normalizeCapabilities({audio: {channels: 0}}), /audio.channels/);
  assert.throws(() => normalizeCapabilities({video: {codecs: ['h264', '']} }), /video.codecs/);
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
  assert.equal(manager.close(), 'closed'); assert.throws(() => manager.receive(createSessionEnvelope({sessionId: offer.sessionId, type: 'session.answer', payload: {accepted: true}})), /transition/);
});

test('session manager can abort an in-flight negotiation for retry', () => {
  const manager = createSessionManager({idFactory: () => 'ses-retry'});
  manager.start({backend: {id: 'host'}});
  assert.equal(manager.close(), 'closed');
  assert.equal(manager.start({backend: {id: 'host'}}).sessionId, 'ses-retry');
});

test('session manager records negotiated capabilities from a compatible answer', () => {
  const manager = createSessionManager({idFactory: () => 'ses-negotiated'});
  const offer = manager.start({backend: {id: 'host'}, capabilities: {transports: ['webrtc', 'websocket'], video: {codecs: ['h264'], maxWidth: 1920, maxHeight: 1080, maxFramerate: 60}, audio: {codecs: ['opus'], channels: 2}}});
  manager.receive(createSessionEnvelope({sessionId: offer.sessionId, type: 'session.answer', payload: {accepted: true, capabilities: {transports: ['websocket'], video: {codecs: ['h264'], maxWidth: 1280, maxHeight: 720, maxFramerate: 30}, audio: {codecs: ['opus'], channels: 1}}}}));
  assert.equal(manager.negotiated.transports[0], 'websocket');
  assert.equal(manager.negotiated.video.maxWidth, 1280);
  assert.equal(manager.negotiated.audio.channels, 1);
});

test('session manager creates a manual quality request for an active session', () => { const manager = createSessionManager({idFactory: () => 'ses-quality'}); const offer = manager.start({backend: {id: 'host'}}); assert.equal(manager.setQuality('high').profile, 'high'); assert.equal(manager.qualityRequest.profile, 'high'); assert.throws(() => manager.setQuality('unknown'), /unknown quality profile/); assert.equal(offer.payload.quality.profile, 'balanced'); });
test('session manager uses bounded quality profiles from session preferences', () => { const manager = createSessionManager({idFactory: () => 'ses-ceiling'}); manager.start({backend: {id: 'host'}, preferences: {qualityPreset: 'high', qualityProfiles: [{id: 'high', maxWidth: 1280, maxHeight: 720, maxFramerate: 30, bitrateKbps: 5000}]}}); assert.deepEqual(manager.qualityRequest, {type: 'quality.request', profile: 'high', maxWidth: 1280, maxHeight: 720, maxFramerate: 30, bitrateKbps: 5000}); });

test('session manager refuses an incompatible answer before connecting', () => {
  const manager = createSessionManager({idFactory: () => 'ses-incompatible'});
  const offer = manager.start({backend: {id: 'host'}, capabilities: {transports: ['webrtc'], video: {codecs: ['av1']}, audio: {codecs: ['opus']}}});
  const answer = createSessionEnvelope({sessionId: offer.sessionId, type: 'session.answer', payload: {accepted: true, capabilities: {transports: ['websocket'], video: {codecs: ['h264']}, audio: {codecs: ['aac']}}}});
  assert.throws(() => manager.receive(answer), /No compatible session transport/);
  assert.equal(manager.state, 'negotiating');
});

test('session manager refuses an explicitly rejected host answer', () => {
  const manager = createSessionManager({idFactory: () => 'ses-rejected'});
  const offer = manager.start({backend: {id: 'host'}});
  assert.throws(() => manager.receive(createSessionEnvelope({sessionId: offer.sessionId, type: 'session.answer', payload: {accepted: false, reason: 'host-busy'}})), /rejected by host/);
  assert.equal(manager.state, 'negotiating');
});

test('host identity and pairing metadata travel only in the session offer', () => {
  const manager = createSessionManager({idFactory: () => 'ses-host'});
  const offer = manager.start({backend: {id: 'spartan-host', backendType: 'remote-play', hostId: 'host-1', pairingCode: 'ABCD23'}});
  assert.equal(offer.payload.hostId, 'host-1');
  assert.equal(offer.payload.pairingCode, 'ABCD23');
});

test('adapter registry rejects duplicate ids and returns immutable adapters', () => {
  const registry = createAdapterRegistry([{id: 'web-provider', kind: 'provider', modes: ['web']}]);
  assert.equal(registry.get('web-provider').kind, 'provider'); assert.throws(() => registry.register({id: 'web-provider'}), /duplicate/); assert.equal(Object.isFrozen(registry.get('web-provider')), true);
});
