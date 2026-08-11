import assert from 'node:assert/strict';
import test from 'node:test';
import { createBrowserHostRuntime } from './browser-host-runtime.mjs';

const offer = {
  protocol: 'spartan-gaming/1',
  messageId: 'msg-offer-01',
  sessionId: 'ses-browser-01',
  type: 'session.offer',
  sentAt: '2026-08-07T12:00:00Z',
  sequence: 0,
  payload: {
    sdp: { type: 'offer', sdp: 'offer' },
    transports: ['webrtc'],
    video: { codecs: ['h264'], maxWidth: 1920, maxHeight: 1080, maxFramerate: 60, hdr: false },
    audio: { codecs: ['opus'], channels: 2 },
    input: { gamepad: false, keyboard: true, pointer: true, rumble: false },
  },
};

function signaling() {
  const listeners = new Map();
  return {
    sent: [],
    async connect() {
      this.connected = true;
    },
    send(message) {
      this.sent.push(message);
    },
    close() {
      this.closed = true;
    },
    on(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
      return () => listeners.get(type)?.delete(handler);
    },
    emit(type, value) {
      for (const handler of listeners.get(type) || []) handler(value);
    },
  };
}
function publisher() {
  const listeners = new Map();
  return {
    stream: { id: 'display' },
    accepted: [],
    candidates: [],
    paused: false,
    async acceptOffer(value) {
      this.accepted.push(value);
      return { type: 'answer', sdp: 'answer' };
    },
    async addIceCandidate(value) {
      this.candidates.push(value);
    },
    setPaused(value) {
      this.paused = value;
    },
    on(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
      return () => listeners.get(type)?.delete(handler);
    },
    emit(type, value) {
      for (const handler of listeners.get(type) || []) handler(value);
    },
    close() {
      this.closed = true;
    },
  };
}

test('browser host runtime joins signaling, negotiates an offer, answers SDP, and forwards ICE/input/quality', async () => {
  const signal = signaling();
  const media = publisher();
  const inputs = [];
  const qualities = [];
  const runtime = createBrowserHostRuntime({
    signaling: signal,
    publisher: media,
    sessionId: 'ses-browser-01',
    onInput: (value) => inputs.push(value),
    onQuality: (value) => qualities.push(value),
  });
  let connected;
  runtime.on('connected', (value) => {
    connected = value;
  });
  await runtime.start();
  assert.equal(runtime.state, 'listening');
  signal.emit('message', offer);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(runtime.state, 'connected');
  assert.equal(media.accepted[0].sdp, 'offer');
  assert.equal(signal.sent[0].type, 'session.answer');
  assert.equal(signal.sent[0].payload.sdp.sdp, 'answer');
  assert.equal(connected.sessionId, 'ses-browser-01');
  media.emit('icecandidate', { candidate: 'local' });
  assert.equal(signal.sent.at(-1).type, 'session.ice-candidate');
  signal.emit('message', {
    ...offer,
    messageId: 'msg-ice',
    type: 'session.ice-candidate',
    sequence: 1,
    payload: { candidate: { candidate: 'remote' } },
  });
  signal.emit('message', {
    ...offer,
    messageId: 'msg-input',
    type: 'input.event',
    sequence: 2,
    payload: { source: 'client', kind: 'button' },
  });
  signal.emit('message', {
    ...offer,
    messageId: 'msg-quality',
    type: 'quality.request',
    sequence: 3,
    payload: { profile: 'low' },
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(media.candidates, [{ candidate: 'remote' }]);
  assert.deepEqual(inputs, [{ source: 'client', kind: 'button' }]);
  assert.deepEqual(qualities, [{ profile: 'low' }]);
  runtime.close();
  assert.equal(runtime.state, 'closed');
});

test('browser host runtime refuses offers until capture is active', async () => {
  const signal = signaling();
  const media = publisher();
  media.stream = null;
  const runtime = createBrowserHostRuntime({
    signaling: signal,
    publisher: media,
    sessionId: 'ses-browser-01',
  });
  await runtime.start();
  signal.emit('message', offer);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(runtime.state, 'error');
  assert.equal(signal.sent.length, 0);
  runtime.close();
});
test('browser host runtime advertises captured audio tracks', async () => {
  const signal = signaling();
  const media = publisher();
  media.stream = { getAudioTracks: () => [{}] };
  const runtime = createBrowserHostRuntime({
    signaling: signal,
    publisher: media,
    sessionId: 'ses-browser-01',
  });
  await runtime.start();
  signal.emit('message', offer);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(signal.sent[0].payload.hostCapabilities.media.audio, true);
  runtime.close();
});
test('browser host runtime forwards session pause controls to the adapter', async () => {
  const signal = signaling();
  const media = publisher();
  media.stream = { getAudioTracks: () => [] };
  const controls = [];
  const runtime = createBrowserHostRuntime({
    signaling: signal,
    publisher: media,
    sessionId: 'ses-browser-01',
    onControl: (value) => controls.push(value),
  });
  await runtime.start();
  signal.emit('message', offer);
  await new Promise((resolve) => setTimeout(resolve, 0));
  signal.emit('message', {
    ...offer,
    type: 'session.control',
    sequence: 2,
    payload: { action: 'pause' },
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(controls, [{ action: 'pause' }]);
  runtime.close();
});
test('browser host runtime applies pause and resume controls to publishers that support them', async () => {
  const signal = signaling();
  const media = publisher();
  media.stream = { getAudioTracks: () => [] };
  const runtime = createBrowserHostRuntime({
    signaling: signal,
    publisher: media,
    sessionId: 'ses-browser-01',
  });
  await runtime.start();
  signal.emit('message', offer);
  await new Promise((resolve) => setTimeout(resolve, 0));
  signal.emit('message', {
    ...offer,
    type: 'session.control',
    sequence: 2,
    payload: { action: 'pause' },
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(media.paused, true);
  signal.emit('message', {
    ...offer,
    type: 'session.control',
    sequence: 3,
    payload: { action: 'resume' },
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(media.paused, false);
  runtime.close();
});
