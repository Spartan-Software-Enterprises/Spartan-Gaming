import assert from 'node:assert/strict';
import test from 'node:test';
import {readTransportPolicy, resolveSignalingTransport} from './transport-config.mjs';

test('player transport settings normalize saved labels without storing credentials', () => {
  const storage = {getItem: () => JSON.stringify({'streaming.transportPreference': 'WebTransport experimental', 'streaming.icePolicy': 'Relay only'})};
  const policy = readTransportPolicy(storage);
  assert.equal(policy.preference, 'webtransport');
  assert.equal(policy.icePolicy, 'relay');
  assert.equal(policy.credentials, 'session-scoped');
});

test('player resolves WebTransport for HTTPS signaling and WebSocket for WSS', () => {
  assert.equal(resolveSignalingTransport({endpoint: 'https://relay.example.test/signal', webTransportAvailable: true}), 'webtransport');
  assert.equal(resolveSignalingTransport({endpoint: 'wss://relay.example.test/signal', webTransportAvailable: true, webSocketAvailable: true}), 'websocket');
  assert.equal(resolveSignalingTransport({endpoint: 'https://relay.example.test/signal', policy: {preference: 'webtransport'}, webTransportAvailable: true}), 'webtransport');
});

test('player fails clearly when a requested transport is unavailable', () => {
  assert.throws(() => resolveSignalingTransport({endpoint: 'https://relay.example.test/signal', policy: {preference: 'webtransport'}, webTransportAvailable: false}), /unavailable/);
  assert.throws(() => resolveSignalingTransport({endpoint: 'wss://relay.example.test/signal', policy: {preference: 'webtransport'}, webTransportAvailable: true}), /compatible endpoint/);
});
