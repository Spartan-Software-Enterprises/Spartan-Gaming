import assert from 'node:assert/strict';
import test from 'node:test';
import {createSessionEnvelope} from '../src/frontend/session/session.mjs';
import {createNativeSignalingBridge, createNativeWeriftConnection} from './native-agent.mjs';

function fakeWerift() {
  class Track { constructor(options) { this.options = options; } writeRtp() {} stop() { this.stopped = true; } }
  class Peer { constructor() {} addTrack(track) { return {track}; } async setRemoteDescription(value) { this.remote = value; } async createAnswer() { return {type: 'answer', sdp: 'native-answer'}; } async setLocalDescription(value) { return value; } close() { this.closed = true; } }
  return {RTCPeerConnection: Peer, MediaStreamTrack: Track, useH264: () => ({mimeType: 'video/H264'})};
}

test('native signaling bridge forwards messages and closes only the scoped connection', async () => {
  const sent = []; let closed = 0; const bridge = createNativeSignalingBridge({connection: {send(message) { sent.push(message); }, close() { closed += 1; }}});
  const received = []; bridge.on('message', message => received.push(message)); bridge.emit('message', {type: 'session.offer'}); bridge.send({type: 'session.answer'}); assert.deepEqual(received, [{type: 'session.offer'}]); assert.deepEqual(sent, [{type: 'session.answer'}]); await bridge.connect(); bridge.close(); bridge.close(); assert.equal(closed, 1); assert.throws(() => bridge.send({type: 'late'}), /closed/);
});

test('native signaling bridge rejects malformed connection dependencies', () => {
  assert.throws(() => createNativeSignalingBridge(), /connection/); assert.throws(() => createNativeSignalingBridge({connection: {}}), /send/);
});

test('native Werift connection bridges an authenticated session into the executable host runtime', async () => {
  const sent = []; const output = {on() {}, off() {}};
  const native = createNativeWeriftConnection({connection: {send(message) { sent.push(message); }, close() {}}, sessionId: 'ses-native-bridge', platform: 'linux', module: fakeWerift(), bindings: {platform: 'linux', capture: {plan() { return {platform: 'linux', output: {target: 'stdout'}, process: {shell: false, args: []}}; }}}, includeAudio: false, pipeline: {videoOutput: output, async start() {}, async stop() {}}});
  const offer = createSessionEnvelope({sessionId: 'ses-native-bridge', type: 'session.offer', payload: {sdp: {type: 'offer', sdp: 'native-offer'}, transports: ['webrtc'], video: {codecs: ['h264'], maxWidth: 1920, maxHeight: 1080, maxFramerate: 60, hdr: false}, audio: {codecs: ['opus'], channels: 2}, input: {gamepad: false, keyboard: true, pointer: true, rumble: false}}});
  await native.start(); native.receive(offer); await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(native.host.state, 'connected'); assert.equal(sent.at(-1).payload.accepted, true); assert.equal(sent.at(-1).payload.sdp.sdp, 'native-answer'); native.close();
});
