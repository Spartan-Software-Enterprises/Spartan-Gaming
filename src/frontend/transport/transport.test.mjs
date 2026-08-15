import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyJitterBufferTarget,
  createWebRtcTransport,
  createWebSocketSignalTransport,
  createWebTransportSignalTransport,
  validateTransportMessage,
} from './transport.mjs';

const message = {
  protocol: 'spartan-gaming/1',
  messageId: 'msg-test-01',
  sessionId: 'ses-test-01',
  type: 'session.offer',
  sentAt: '2026-08-07T12:00:00Z',
  payload: {},
};

test('jitter buffer target is bounded and capability-gated', () => {
  const receiver = { jitterBufferTarget: null };
  assert.equal(applyJitterBufferTarget(receiver, 720), true);
  assert.equal(receiver.jitterBufferTarget, 500);
  assert.equal(applyJitterBufferTarget(receiver, -10), true);
  assert.equal(receiver.jitterBufferTarget, 0);
  assert.equal(applyJitterBufferTarget({}, 60), false);
  assert.equal(applyJitterBufferTarget(receiver, Number.NaN), false);
});

test('WebSocket signaling sends and receives validated envelopes', async () => {
  let instance;
  class FakeSocket {
    constructor(url) {
      instance = this;
      this.url = url;
    }
    send(value) {
      this.sent = JSON.parse(value);
    }
    close() {
      this.onclose?.({ code: 1000 });
    }
  }
  const transport = createWebSocketSignalTransport({
    endpoint: 'ws://localhost:8787/signal',
    WebSocketImpl: FakeSocket,
  });
  const received = [];
  transport.on('message', (value) => received.push(value));
  const opening = transport.connect();
  instance.onopen();
  await opening;
  transport.send(message);
  instance.onmessage({ data: JSON.stringify(message) });
  assert.equal(transport.state, 'open');
  assert.deepEqual(instance.sent, message);
  assert.equal(received[0].sessionId, 'ses-test-01');
  transport.close();
  assert.equal(transport.state, 'closed');
});
test('WebSocket signaling rejects insecure remote endpoints', () => {
  assert.throws(
    () =>
      createWebSocketSignalTransport({
        endpoint: 'ws://remote.example/signal',
        WebSocketImpl: class {},
      }),
    /TLS/,
  );
});
test('WebSocket signaling sends an optional authenticated join frame before envelopes', async () => {
  let instance;
  class FakeSocket {
    constructor() {
      instance = this;
    }
    send(value) {
      (this.sent ||= []).push(JSON.parse(value));
    }
  }
  const transport = createWebSocketSignalTransport({
    endpoint: 'ws://localhost:8790/signal',
    join: { sessionId: 'ses-join-01', role: 'client', ticket: 'ticket' },
    WebSocketImpl: FakeSocket,
  });
  const opening = transport.connect();
  instance.onopen();
  await opening;
  assert.deepEqual(instance.sent, [
    { type: 'signaling.join', sessionId: 'ses-join-01', role: 'client', ticket: 'ticket' },
  ]);
});
test('WebTransport signaling sends datagrams, routes envelopes, and supports authenticated join', async () => {
  let instance;
  const writes = [];
  const reader = {
    read: () =>
      new Promise((resolve) => {
        reader.resolve = resolve;
      }),
    cancel: () => reader.resolve?.({ done: true }),
  };
  const writer = {
    write: async (value) => writes.push(JSON.parse(new TextDecoder().decode(value))),
    releaseLock() {},
  };
  class FakeWebTransport {
    constructor(url) {
      instance = this;
      this.url = url;
      this.ready = Promise.resolve();
      this.datagrams = {
        writable: { getWriter: () => writer },
        readable: { getReader: () => reader },
      };
    }
    close() {
      this.closed = true;
    }
  }
  const transport = createWebTransportSignalTransport({
    endpoint: 'https://relay.example.test/signal',
    join: { sessionId: 'ses-wt-01', role: 'client', ticket: 'ticket' },
    WebTransportImpl: FakeWebTransport,
  });
  await transport.connect();
  await transport.send(message);
  assert.deepEqual(writes, [
    { type: 'signaling.join', sessionId: 'ses-wt-01', role: 'client', ticket: 'ticket' },
    message,
  ]);
  assert.equal(instance.url, 'https://relay.example.test/signal');
  transport.close();
  assert.equal(transport.state, 'closed');
});
test('WebTransport signaling rejects non-HTTPS endpoints', () => {
  assert.throws(
    () =>
      createWebTransportSignalTransport({
        endpoint: 'wss://relay.example.test/signal',
        WebTransportImpl: class {},
      }),
    /https/,
  );
});
test('WebRTC transport creates offers, accepts answers, and forwards ICE', async () => {
  let instance;
  class FakePeer {
    constructor() {
      instance = this;
      this.localDescription = null;
    }
    createOffer() {
      return Promise.resolve({ type: 'offer', sdp: 'offer' });
    }
    setLocalDescription(value) {
      this.localDescription = value;
      return Promise.resolve();
    }
    setRemoteDescription(value) {
      this.answer = value;
      return Promise.resolve();
    }
    addIceCandidate(value) {
      this.candidate = value;
      return Promise.resolve();
    }
    close() {
      this.closed = true;
    }
    createDataChannel() {
      return { label: 'spartan-control' };
    }
  }
  const transport = createWebRtcTransport({ RTCPeerConnectionImpl: FakePeer });
  const candidates = [];
  transport.on('icecandidate', (candidate) => candidates.push(candidate));
  const offer = await transport.createOffer();
  assert.equal(offer.type, 'offer');
  await transport.acceptAnswer({ type: 'answer', sdp: 'answer' });
  assert.equal(transport.state, 'connected');
  instance.onicecandidate({ candidate: { candidate: 'candidate' } });
  assert.equal(candidates.length, 1);
  await transport.addIceCandidate(candidates[0]);
  transport.close();
  assert.equal(transport.state, 'closed');
});
test('WebRTC transport applies validated ephemeral ICE configuration', () => {
  let configuration;
  class FakePeer {
    constructor(value) {
      configuration = value;
    }
    close() {}
  }
  createWebRtcTransport({
    RTCPeerConnectionImpl: FakePeer,
    ice: { servers: [{ urls: 'stun:stun.example.test' }], policy: 'relay' },
  });
  assert.equal(configuration.iceTransportPolicy, 'relay');
  assert.equal(configuration.iceServers[0].urls[0], 'stun:stun.example.test');
});
test('WebRTC transport exposes host-created data channels', () => {
  let instance;
  class FakePeer {
    constructor() {
      instance = this;
    }
    close() {}
  }
  const transport = createWebRtcTransport({ RTCPeerConnectionImpl: FakePeer });
  const channels = [];
  transport.on('datachannel', (channel) => channels.push(channel));
  instance.ondatachannel({ channel: { label: 'host-control' } });
  assert.deepEqual(channels, [{ label: 'host-control' }]);
});
test('transport message validation fails closed for unknown types', () => {
  assert.throws(() => validateTransportMessage({ ...message, type: 'private.command' }), /invalid/);
});
test('transport message validation rejects malformed envelope fields', () => {
  for (const invalid of [
    { ...message, messageId: 'short' },
    { ...message, messageId: 12345678 },
    { ...message, sessionId: 'invalid space' },
    { ...message, sessionId: 12345678 },
    { ...message, sentAt: 'not-a-timestamp' },
    { ...message, sentAt: '2024-02-30T00:00:00Z' },
    { ...message, sentAt: '2024-01-01T24:00:00Z' },
    { ...message, sequence: -1 },
    { ...message, sequence: 1.5 },
    { ...message, sequence: Number.MAX_SAFE_INTEGER + 1 },
    { ...message, payload: [] },
    { ...message, unexpected: true },
  ])
    assert.throws(() => validateTransportMessage(invalid), /invalid/);
  assert.doesNotThrow(() => validateTransportMessage({ ...message, sequence: 0 }));
});

test('transport message validation restricts session controls to pause and resume', () => {
  assert.doesNotThrow(() =>
    validateTransportMessage({ ...message, type: 'session.control', payload: { action: 'pause' } }),
  );
  assert.throws(
    () =>
      validateTransportMessage({
        ...message,
        type: 'session.control',
        payload: { action: 'quit' },
      }),
    /session control/,
  );
});
