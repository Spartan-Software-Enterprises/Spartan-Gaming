import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSessionTransportOptions,
  normalizeTransportPolicy,
  selectSessionTransport,
} from './policy.mjs';

test('transport policy defaults to WebRTC with safe fallbacks', () => {
  const policy = normalizeTransportPolicy();
  assert.deepEqual(policy, {
    preference: 'auto',
    icePolicy: 'all',
    allowWebTransport: true,
    allowWebSocketFallback: true,
    credentials: 'session-scoped',
  });
  assert.equal(
    selectSessionTransport({
      clientTransports: ['websocket', 'webrtc'],
      remoteTransports: ['webrtc', 'websocket'],
    }),
    'webrtc',
  );
});

test('transport policy honors explicit preference and fallback gates', () => {
  assert.equal(
    selectSessionTransport({
      clientTransports: ['webtransport', 'websocket'],
      remoteTransports: ['webtransport', 'websocket'],
      policy: { preference: 'webtransport' },
    }),
    'webtransport',
  );
  assert.throws(
    () =>
      selectSessionTransport({
        clientTransports: ['websocket'],
        remoteTransports: ['websocket'],
        policy: { allowWebSocketFallback: false },
      }),
    /No permitted/,
  );
  assert.throws(
    () =>
      selectSessionTransport({
        clientTransports: ['webrtc'],
        remoteTransports: ['webrtc'],
        policy: { preference: 'webtransport' },
      }),
    /Preferred/,
  );
});

test('session transport options keep ICE credentials out of saved policy', () => {
  const options = createSessionTransportOptions({
    policy: { icePolicy: 'relay' },
    ice: {
      servers: [{ urls: 'turns:relay.example.test:443', username: 'u', credential: 'secret' }],
    },
  });
  assert.equal(options.ice.iceTransportPolicy, 'relay');
  assert.equal(options.policy.credentials, 'session-scoped');
  assert.equal('iceServers' in options.policy, false);
});
