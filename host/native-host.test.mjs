import assert from 'node:assert/strict';
import test from 'node:test';
import {createSessionEnvelope} from '../src/frontend/session/session.mjs';
import {createNativeWeriftHost} from './native-host.mjs';

function fakeWerift() {
  class Track { constructor(options) { this.options = options; this.packets = []; } writeRtp(packet) { this.packets.push(packet); } stop() { this.stopped = true; } }
  class Peer { constructor(config) { this.config = config; this.tracks = []; } addTrack(track) { this.tracks.push(track); return {track}; } async setRemoteDescription(value) { this.remote = value; } async createAnswer() { return {type: 'answer', sdp: 'native-answer'}; } async setLocalDescription(value) { this.local = value; return value; } close() { this.closed = true; } }
  return {RTCPeerConnection: Peer, MediaStreamTrack: Track, useH264: () => ({mimeType: 'video/H264'}), useOpus: () => ({mimeType: 'audio/opus'})};
}

function signal() {
  const listeners = new Map();
  return {
    sent: [],
    on(type, handler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); return () => listeners.get(type)?.delete(handler); },
    emit(type, value) { for (const handler of listeners.get(type) || []) void handler(value); },
    async connect() {},
    send(message) { this.sent.push(message); },
    close() { this.closed = true; },
  };
}

test('native Werift host composes pipeline startup, SDP negotiation, and publisher teardown', async () => {
  const signaling = signal(); const output = {listeners: new Set(), on(type, handler) { if (type === 'data') this.listeners.add(handler); }, off(type, handler) { if (type === 'data') this.listeners.delete(handler); }};
  let started = 0; let stopped = 0;
  const pipeline = {videoOutput: output, async start() { started += 1; }, async stop() { stopped += 1; }};
  const packetizer = {push(chunk, metadata) { return [{payload: chunk, timestamp: metadata.timestamp}]; }};
  const offer = createSessionEnvelope({sessionId: 'ses-native-01', type: 'session.offer', payload: {sdp: {type: 'offer', sdp: 'native-offer'}, transports: ['webrtc'], video: {codecs: ['h264']}, audio: {codecs: ['opus']}, input: {gamepad: true, keyboard: true, pointer: true, rumble: true}}});
  const host = createNativeWeriftHost({signaling, module: fakeWerift(), pipeline, packetizer, sessionId: offer.sessionId});
  await host.start(); signaling.emit('message', offer); await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(host.state, 'connected'); assert.equal(started, 1); assert.equal(signaling.sent.at(-1).payload.sdp.sdp, 'native-answer');
  host.close(); await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(stopped, 1); assert.equal(host.state, 'closed');
});

test('native Werift host can construct its pipeline from shell-free capture and encoder plans', () => {
  const signal = {on() { return () => {}; }, async connect() {}, send() {}, close() {}};
  const capturePlan = {process: {shell: false, args: []}, output: {target: 'stdout'}};
  const encoderPlan = {process: {shell: false, args: []}};
  const host = createNativeWeriftHost({signaling: signal, module: fakeWerift(), capturePlan, encoderPlan, packetizer: {push: () => []}, sessionId: 'ses-plan-01'});
  assert.equal(host.pipeline.state, 'idle'); assert.equal(host.state, 'idle');
});
test('native Werift host starts and tears down shared-peer audio publishing', async () => { const signaling = signal(); const videoOutput = {listeners: new Set(), on(type, handler) { if (type === 'data') this.listeners.add(handler); }, off(type, handler) { if (type === 'data') this.listeners.delete(handler); }}; const audioOutput = {listeners: new Set(), on(type, handler) { if (type === 'data') this.listeners.add(handler); }, off(type, handler) { if (type === 'data') this.listeners.delete(handler); }, emit(value) { for (const handler of this.listeners) handler(value); }}; const pipeline = {videoOutput, async start() {}, async stop() {}}; const audioPipeline = {audioOutput, async start() {}, async stop() {}}; const host = createNativeWeriftHost({signaling, module: fakeWerift(), pipeline, audioPipeline, audioPacketizer: {push: chunk => [{payload: chunk}]}, audioPermissionGranted: true, packetizer: {push: () => []}, sessionId: 'ses-native-audio'}); const offer = createSessionEnvelope({sessionId: 'ses-native-audio', type: 'session.offer', payload: {sdp: {type: 'offer', sdp: 'native-offer'}, transports: ['webrtc'], video: {codecs: ['h264']}, audio: {codecs: ['opus']}, input: {gamepad: true, keyboard: true, pointer: true, rumble: true}}}); await host.start(); signaling.emit('message', offer); await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(host.state, 'connected'); audioOutput.emit(Buffer.from('voice')); assert.equal(host.audioPublisher.packetsSent, 1); host.close(); await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(host.audioPublisher.publisher.state, 'stopped'); });
