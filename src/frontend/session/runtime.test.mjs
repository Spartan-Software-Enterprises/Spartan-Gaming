import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionEnvelope} from './session.mjs';
import {createSessionRuntime} from './runtime.mjs';

function fakeTransport() { const listeners = new Map(); return {state: 'idle', sent: [], on(type, handler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); return () => listeners.get(type)?.delete(handler); }, async connect() { this.state = 'open'; }, send(message) { this.sent.push(message); }, close() { this.state = 'closed'; }, emit(type, value) { for (const handler of listeners.get(type) || []) handler(value); }}; }

test('session runtime connects signaling, sends an offer, and routes answers', async () => {
  const signaling = fakeTransport(); const runtime = createSessionRuntime({signaling, clock: () => '2026-08-07T12:00:00.000Z'});
  const offer = await runtime.start({backend: {id: 'spartan-host', backendType: 'remote-play'}});
  assert.equal(runtime.state, 'negotiating'); assert.equal(signaling.sent[0].type, 'session.offer');
  signaling.emit('message', createSessionEnvelope({sessionId: offer.sessionId, type: 'session.answer', payload: {accepted: true}}));
  assert.equal(runtime.state, 'connected');
});

test('session runtime forwards reconnect and input envelopes through signaling', async () => {
  const signaling = fakeTransport(); const runtime = createSessionRuntime({signaling});
  const offer = await runtime.start({backend: {id: 'spartan-host'}});
  signaling.emit('message', createSessionEnvelope({sessionId: offer.sessionId, type: 'session.answer', payload: {accepted: true}}));
  const reconnect = runtime.requestReconnect(); runtime.send(createSessionEnvelope({sessionId: offer.sessionId, type: 'input.event', payload: {action: 'confirm', pressed: true, value: 1}}));
  assert.equal(reconnect.type, 'session.reconnect'); assert.equal(signaling.sent.at(-1).type, 'input.event'); assert.equal(signaling.sent.filter(item => item.type === 'session.reconnect').length, 1);
});

test('session runtime accepts WebRTC answers and emits media streams', async () => {
  const signaling = fakeTransport(); const listeners = new Map(); let data;
  const media = {on(type, handler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); return () => listeners.get(type)?.delete(handler); }, createDataChannel() { data = {readyState: 'connecting', send(value) { this.value = JSON.parse(value); }}; return data; }, async createOffer() { return {type: 'offer', sdp: 'browser-offer'}; }, async acceptAnswer(value) { this.answer = value; }, addIceCandidate(value) { this.candidate = value; }, close() {}, emit(type, value) { for (const handler of listeners.get(type) || []) handler(value); }};
  const runtime = createSessionRuntime({signaling, media}); const streams = []; runtime.on('stream', stream => streams.push(stream)); const offer = await runtime.start({backend: {id: 'spartan-host'}});
  assert.equal(offer.payload.sdp.sdp, 'browser-offer');
  signaling.emit('message', createSessionEnvelope({sessionId: offer.sessionId, type: 'session.answer', payload: {accepted: true, sdp: {type: 'answer', sdp: 'host-answer'}}}));
  media.emit('track', {streams: ['stream-01']}); assert.equal(media.answer.sdp, 'host-answer'); assert.deepEqual(streams, ['stream-01']);
});
