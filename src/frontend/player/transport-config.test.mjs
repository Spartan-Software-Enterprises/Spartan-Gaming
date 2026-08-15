import assert from 'node:assert/strict';
import test from 'node:test';
import {
  readTransportPolicy,
  resolveSignalingEndpoint,
  resolveSignalingTransport,
} from './transport-config.mjs';

test('player transport settings normalize saved labels without storing credentials', () => {
  const storage = {
    getItem: () =>
      JSON.stringify({
        'streaming.transportPreference': 'WebTransport experimental',
        'streaming.icePolicy': 'Relay only',
      }),
  };
  const policy = readTransportPolicy(storage);
  assert.equal(policy.preference, 'webtransport');
  assert.equal(policy.icePolicy, 'relay');
  assert.equal(policy.credentials, 'session-scoped');
});

test('experimental WebTransport requires both the streaming permission and advanced master toggle', () => {
  const disabled = {
    getItem: () =>
      JSON.stringify({
        'streaming.transportPreference': 'WebTransport experimental',
        'advanced.experimentalWebTransport': false,
      }),
  };
  assert.equal(readTransportPolicy(disabled).allowWebTransport, false);
  const enabled = {
    getItem: () =>
      JSON.stringify({
        'streaming.transportPreference': 'WebTransport experimental',
        'streaming.allowWebTransport': true,
        'advanced.experimentalWebTransport': true,
      }),
  };
  assert.equal(readTransportPolicy(enabled).allowWebTransport, true);
});

test('privacy WebRTC IP protection overrides the all-candidates stream setting', () => {
  const storage = {
    getItem: () =>
      JSON.stringify({
        'streaming.icePolicy': 'All candidates',
        'privacy.preventWebRtcIpLeak': true,
      }),
  };
  assert.equal(readTransportPolicy(storage).icePolicy, 'relay');
  const relaxed = {
    getItem: () =>
      JSON.stringify({
        'streaming.icePolicy': 'All candidates',
        'privacy.preventWebRtcIpLeak': false,
      }),
  };
  assert.equal(readTransportPolicy(relaxed).icePolicy, 'all');
});

test('player resolves WebTransport for HTTPS signaling and WebSocket for WSS', () => {
  assert.equal(
    resolveSignalingTransport({
      endpoint: 'https://relay.example.test/signal',
      webTransportAvailable: true,
    }),
    'webtransport',
  );
  assert.equal(
    resolveSignalingTransport({
      endpoint: 'wss://relay.example.test/signal',
      webTransportAvailable: true,
      webSocketAvailable: true,
    }),
    'websocket',
  );
  assert.equal(
    resolveSignalingTransport({
      endpoint: 'https://relay.example.test/signal',
      policy: { preference: 'webtransport' },
      webTransportAvailable: true,
    }),
    'webtransport',
  );
  assert.equal(
    resolveSignalingTransport({
      endpoint: 'https://relay.example.test/signal',
      policy: { preference: 'webrtc' },
      webTransportAvailable: true,
    }),
    'webtransport',
  );
  assert.equal(
    resolveSignalingTransport({
      endpoint: 'wss://relay.example.test/signal',
      policy: { preference: 'webrtc' },
      webSocketAvailable: true,
    }),
    'websocket',
  );
});

test('player fails clearly when a requested transport is unavailable', () => {
  assert.throws(
    () =>
      resolveSignalingTransport({
        endpoint: 'https://relay.example.test/signal',
        policy: { preference: 'webtransport' },
        webTransportAvailable: false,
      }),
    /unavailable/,
  );
  assert.throws(
    () =>
      resolveSignalingTransport({
        endpoint: 'wss://relay.example.test/signal',
        policy: { preference: 'webtransport' },
        webTransportAvailable: true,
      }),
    /compatible endpoint/,
  );
});
test('player signaling endpoint precedence preserves explicit handoffs before custom settings', () => {
  assert.equal(
    resolveSignalingEndpoint({ customEndpoint: 'wss://settings.example/signal' }),
    'wss://settings.example/signal',
  );
  assert.equal(
    resolveSignalingEndpoint({
      queryEndpoint: 'wss://query.example/signal',
      pendingEndpoint: 'wss://pair.example/signal',
      customEndpoint: 'wss://settings.example/signal',
    }),
    'wss://query.example/signal',
  );
  assert.equal(
    resolveSignalingEndpoint({
      queryEndpoint: '  ',
      recoveryEndpoint: 'wss://recovery.example/signal',
    }),
    'wss://recovery.example/signal',
  );
  assert.equal(resolveSignalingEndpoint(), '');
});

test('player transport selection rejects unsafe endpoints before choosing a transport', () => {
  assert.throws(
    () => resolveSignalingTransport({ endpoint: 'ws://relay.example.test/signal' }),
    /secure URL/,
  );
  assert.throws(
    () => resolveSignalingTransport({ endpoint: 'wss://user:ticket@relay.example.test/signal' }),
    /secure URL/,
  );
  assert.throws(() => resolveSignalingTransport({ endpoint: 'not a URL' }), /invalid/);
  assert.equal(
    resolveSignalingTransport({ endpoint: 'ws://localhost:8790/signal', webSocketAvailable: true }),
    'websocket',
  );
});
