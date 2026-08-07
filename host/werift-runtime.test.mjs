import assert from 'node:assert/strict';
import test from 'node:test';
import {createSessionEnvelope} from '../src/frontend/session/session.mjs';
import {createWeriftHostRuntime} from './werift-runtime.mjs';

function signal() {
  const listeners = new Map();
  return {
    sent: [],
    connected: false,
    on(type, handler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); return () => listeners.get(type)?.delete(handler); },
    emit(type, value) { for (const handler of listeners.get(type) || []) void handler(value); },
    async connect() { this.connected = true; },
    send(message) { this.sent.push(message); },
    close() { this.closed = true; },
  };
}

const offer = createSessionEnvelope({
  sessionId: 'ses-werift-01', type: 'session.offer',
  payload: {sdp: {type: 'offer', sdp: 'offer'}, transports: ['webrtc'], video: {codecs: ['h264'], maxWidth: 1920, maxHeight: 1080, maxFramerate: 60}, audio: {codecs: ['opus'], channels: 2}, input: {gamepad: true, keyboard: true, pointer: true, rumble: true}},
});

test('Werift host runtime negotiates SDP and routes session messages', async () => {
  const signaling = signal();
  const inputs = [];
  const qualities = [];
  const candidates = [];
  const session = {
    async acceptOffer(value) { this.offer = value; return {type: 'answer', sdp: 'answer'}; },
    async addIceCandidate(value) { candidates.push(value); },
    async close() { this.closed = true; },
  };
  const runtime = createWeriftHostRuntime({signaling, sessionId: offer.sessionId, sessionFactory: async options => { options.onIceCandidate({candidate: 'local'}); return session; }, onInput: value => inputs.push(value), onQuality: value => qualities.push(value)});
  await runtime.start();
  assert.equal(runtime.state, 'listening');
  signaling.emit('message', offer);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(runtime.state, 'connected');
  assert.equal(session.offer.sdp, 'offer');
  assert.equal(signaling.sent.at(-1).type, 'session.answer');
  assert.equal(signaling.sent.at(-1).payload.sdp.sdp, 'answer');
  assert.equal(signaling.sent[0].type, 'session.ice-candidate');
  signaling.emit('message', createSessionEnvelope({sessionId: offer.sessionId, type: 'session.ice-candidate', sequence: 1, payload: {candidate: {candidate: 'remote'}}}));
  signaling.emit('message', createSessionEnvelope({sessionId: offer.sessionId, type: 'input.event', sequence: 2, payload: {kind: 'button'}}));
  signaling.emit('message', createSessionEnvelope({sessionId: offer.sessionId, type: 'quality.request', sequence: 3, payload: {profile: 'low'}}));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(candidates, [{candidate: 'remote'}]);
  assert.deepEqual(inputs, [{kind: 'button'}]);
  assert.deepEqual(qualities, [{profile: 'low'}]);
  runtime.close();
  assert.equal(session.closed, true);
  assert.equal(runtime.state, 'closed');
});

test('Werift host runtime rejects offers without SDP and reports errors', async () => {
  const signaling = signal();
  const errors = [];
  const runtime = createWeriftHostRuntime({signaling, sessionId: 'ses-error', sessionFactory: () => { throw new Error('should not create'); }});
  runtime.on('error', error => errors.push(error));
  await runtime.start();
  signaling.emit('message', createSessionEnvelope({sessionId: 'ses-error', type: 'session.offer', payload: {transports: ['webrtc'], video: {codecs: ['h264']}, audio: {codecs: ['opus']}}}));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(runtime.state, 'error');
  assert.match(errors[0].message, /SDP offer/);
});
