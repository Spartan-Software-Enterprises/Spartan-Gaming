import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionEnvelope} from './session.mjs';
import {createSessionRuntime} from './runtime.mjs';

function fakeTransport() { const listeners = new Map(); return {state: 'idle', sent: [], on(type, handler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); return () => listeners.get(type)?.delete(handler); }, async connect() { this.state = 'open'; }, send(message) { this.sent.push(message); }, close() { this.state = 'closed'; }, emit(type, value) { for (const handler of listeners.get(type) || []) handler(value); }}; }

test('session runtime connects signaling, sends an offer, and routes answers', async () => {
  const signaling = fakeTransport(); const runtime = createSessionRuntime({signaling, clock: () => '2026-08-07T12:00:00.000Z'});
  const launch = {version: 1, kind: 'emulator', coreId: 'dolphin', runtime: {id: 'dolphin-linux', kind: 'native-emulator', version: '5.0'}, hostContentId: 'entry-1', content: {game: {name: 'game.iso', size: 1}, firmware: []}, consent: {approved: true, at: '2026-08-08T00:00:00.000Z'}};
  const offer = await runtime.start({backend: {id: 'spartan-host', backendType: 'remote-play'}, launch});
  assert.equal(runtime.state, 'negotiating'); assert.equal(signaling.sent[0].type, 'session.offer');
  assert.deepEqual(signaling.sent[0].payload.launch, launch);
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

test('session runtime sends a new quality request after degraded telemetry', async () => {
  const signaling = fakeTransport(); const runtime = createSessionRuntime({signaling});
  const offer = await runtime.start({backend: {id: 'spartan-host'}});
  signaling.emit('message', createSessionEnvelope({sessionId: offer.sessionId, type: 'session.answer', payload: {accepted: true}}));
  signaling.emit('message', createSessionEnvelope({sessionId: offer.sessionId, type: 'telemetry.health', payload: {packetLossPct: 9}}));
  assert.equal(signaling.sent.at(-1).type, 'quality.request'); assert.equal(signaling.sent.at(-1).payload.profile, 'low');
});

test('session runtime sends validated manual quality requests', async () => { const signaling = fakeTransport(); const runtime = createSessionRuntime({signaling}); const offer = await runtime.start({backend: {id: 'spartan-host'}}); const request = runtime.requestQuality('high'); assert.equal(request.type, 'quality.request'); assert.equal(request.payload.profile, 'high'); assert.equal(request.sessionId, offer.sessionId); assert.throws(() => runtime.requestQuality('invalid'), /unknown quality profile/); });
test('session runtime sends validated pause and resume control requests', async () => { const signaling = fakeTransport(); const runtime = createSessionRuntime({signaling}); const offer = await runtime.start({backend: {id: 'spartan-host'}}); const pause = runtime.requestControl('pause'); assert.equal(pause.type, 'session.control'); assert.equal(pause.payload.action, 'pause'); assert.equal(pause.sessionId, offer.sessionId); assert.throws(() => runtime.requestControl('seek'), /invalid/); });

test('session runtime emits a transport error for incompatible host capabilities', async () => {
  const signaling = fakeTransport(); const runtime = createSessionRuntime({signaling}); const errors = []; runtime.on('error', error => errors.push(error));
  const offer = await runtime.start({backend: {id: 'spartan-host'}, capabilities: {transports: ['webrtc'], video: {codecs: ['av1']}, audio: {codecs: ['opus']}}});
  const accepted = runtime.receive(createSessionEnvelope({sessionId: offer.sessionId, type: 'session.answer', payload: {accepted: true, capabilities: {transports: ['websocket'], video: {codecs: ['h264']}, audio: {codecs: ['aac']}}}}));
  assert.equal(accepted, false); assert.match(errors[0].message, /No compatible session transport/); assert.equal(runtime.state, 'negotiating');
});

test('session runtime emits a transport error for an explicit host refusal', async () => {
  const signaling = fakeTransport(); const runtime = createSessionRuntime({signaling}); const errors = []; runtime.on('error', error => errors.push(error));
  const offer = await runtime.start({backend: {id: 'spartan-host'}});
  assert.equal(runtime.receive(createSessionEnvelope({sessionId: offer.sessionId, type: 'session.answer', payload: {accepted: false, reason: 'host-busy'}})), false);
  assert.match(errors[0].message, /rejected by host/); assert.equal(runtime.state, 'negotiating');
});

test('session runtime reports asynchronous media answer failures without unhandled rejection', async () => {
  const signaling = fakeTransport(); const listeners = new Map(); const errors = [];
  const media = {on(type, handler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); return () => listeners.get(type)?.delete(handler); }, async createOffer() { return {type: 'offer', sdp: 'browser-offer'}; }, async acceptAnswer() { throw new Error('remote SDP could not be applied'); }, close() {}};
  const runtime = createSessionRuntime({signaling, media}); runtime.on('error', error => errors.push(error));
  const offer = await runtime.start({backend: {id: 'spartan-host'}});
  runtime.receive(createSessionEnvelope({sessionId: offer.sessionId, type: 'session.answer', payload: {accepted: true, sdp: {type: 'answer', sdp: 'bad-answer'}}}));
  await new Promise(resolve => setImmediate(resolve));
  assert.match(errors[0].message, /remote SDP could not be applied/); assert.equal(runtime.state, 'connected');
});
