import assert from 'node:assert/strict';
import test from 'node:test';
import {createWeriftAudioRtpPublisher, createWeriftAudioTransport, createWeriftRtpPublisher, createWeriftSession, createWeriftVideoTransport, loadWerift} from './werift-adapter.mjs';

function fakeWerift() {
  class Track { constructor(options) { this.options = options; this.packets = []; } writeRtp(packet) { this.packets.push(packet); } stop() { this.stopped = true; } }
  class Peer { constructor(config) { this.config = config; this.tracks = []; } addTrack(track) { this.tracks.push(track); return {track}; } close() { this.closed = true; } }
  return {RTCPeerConnection: Peer, MediaStreamTrack: Track, useH264: () => ({mimeType: 'video/H264'}), useOpus: () => ({mimeType: 'audio/opus'})};
}

test('Werift adapter creates a video track and forwards RTP packets', () => { const module = fakeWerift(); const adapter = createWeriftVideoTransport({module, peerConfig: {iceServers: []}, ssrc: 42}); const packet = {header: {timestamp: 10}, payload: Buffer.from('frame')}; adapter.transport.send(packet); assert.equal(adapter.track.options.kind, 'video'); assert.equal(adapter.track.options.ssrc, 42); assert.deepEqual(adapter.track.packets, [packet]); assert.equal(adapter.sender.track, adapter.track); adapter.close(); assert.equal(adapter.track.stopped, true); assert.equal(adapter.peer.closed, true); assert.throws(() => adapter.transport.send(packet), /closed/); });
test('Werift loader is optional and preserves the injected package boundary', async () => { const module = await loadWerift({loader: async name => { assert.equal(name, 'werift'); return {ready: true}; }}); assert.equal(module.ready, true); });

test('Werift RTP publisher composes encoded chunks with an injected packetizer', async () => {
  const module = fakeWerift(); const output = {listeners: new Set(), on(type, handler) { if (type === 'data') this.listeners.add(handler); }, off(type, handler) { if (type === 'data') this.listeners.delete(handler); }, emit(value) { for (const handler of this.listeners) handler(value); }};
  const pipeline = {videoOutput: output, async start() {}, async stop() {}}; const packetizer = {push(chunk, metadata) { return [{payload: chunk, timestamp: metadata.timestamp}]; }};
  const result = createWeriftRtpPublisher({module, pipeline, packetizer, codec: 'h264'}); await result.publisher.start(); output.emit(Buffer.from('frame')); await result.publisher.stop();
  assert.equal(result.packetsSent, 1); assert.deepEqual(result.adapter.track.packets[0].payload, Buffer.from('frame')); assert.equal(result.adapter.track.packets[0].timestamp, 0); assert.equal(result.adapter.track.stopped, true);
});

test('Werift RTP publisher advances video timestamps at a 60fps clock', async () => {
  const module = fakeWerift(); const output = {listeners: new Set(), on(type, handler) { if (type === 'data') this.listeners.add(handler); }, off(type, handler) { if (type === 'data') this.listeners.delete(handler); }, emit(value) { for (const handler of this.listeners) handler(value); }};
  const timestamps = []; const result = createWeriftRtpPublisher({module, pipeline: {videoOutput: output, async start() {}, async stop() {}}, packetizer: {push(chunk, metadata) { timestamps.push(metadata.timestamp); return [{payload: chunk}]; }}});
  await result.publisher.start(); output.emit(Buffer.from('a')); output.emit(Buffer.from('b')); await result.publisher.stop(); assert.deepEqual(timestamps, [0, 1500]);
});
test('Werift audio transport shares a peer and publishes RTP audio', async () => { const module = fakeWerift(); const video = createWeriftVideoTransport({module}); const audio = createWeriftAudioTransport({module, peer: video.peer}); assert.equal(audio.track.options.kind, 'audio'); assert.equal(video.peer.tracks.length, 2); const output = {listeners: new Set(), on(type, handler) { if (type === 'data') this.listeners.add(handler); }, off(type, handler) { if (type === 'data') this.listeners.delete(handler); }, emit(value) { for (const handler of this.listeners) handler(value); }}; const result = createWeriftAudioRtpPublisher({module, pipeline: {audioOutput: output, async start() {}, async stop() {}}, packetizer: {push: chunk => [{payload: chunk}]}, peer: video.peer, permissionGranted: true}); await result.publisher.start(); output.emit(Buffer.from('voice')); await result.publisher.stop(); assert.equal(result.packetsSent, 1); assert.deepEqual(result.adapter.track.packets[0].payload, Buffer.from('voice')); audio.close(); video.close(); });

test('Werift session answers SDP offers and forwards ICE lifecycle events', async () => {
  const module = fakeWerift(); const adapter = createWeriftVideoTransport({module}); let remote; let local; const candidates = []; const states = [];
  adapter.peer.setRemoteDescription = async value => { remote = value; }; adapter.peer.createAnswer = async () => ({type: 'answer', sdp: 'answer-sdp'}); adapter.peer.setLocalDescription = async value => { local = value; return value; }; adapter.peer.addIceCandidate = async value => { adapter.peer.candidate = value; };
  const session = createWeriftSession({adapter, onIceCandidate: candidate => candidates.push(candidate), onStateChange: state => states.push(state)}); const answer = await session.acceptOffer({type: 'offer', sdp: 'offer-sdp'}); await session.addIceCandidate({candidate: 'candidate'}); assert.deepEqual(remote, {type: 'offer', sdp: 'offer-sdp'}); assert.deepEqual(local, {type: 'answer', sdp: 'answer-sdp'}); assert.deepEqual(answer, {type: 'answer', sdp: 'answer-sdp'}); assert.deepEqual(adapter.peer.candidate, {candidate: 'candidate'}); assert.deepEqual(candidates, []); assert.deepEqual(states, []); await session.close();
});
