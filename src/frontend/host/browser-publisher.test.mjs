import assert from 'node:assert/strict';
import test from 'node:test';
import {createBrowserCaptureConstraints, createBrowserWebRtcPublisher, createMicrophoneConstraints, createVideoEncodingParameters, normalizeBrowserQualityRequest} from './browser-publisher.mjs';

test('browser capture constraints are bounded, explicit, and consent-safe', () => {
  assert.deepEqual(createBrowserCaptureConstraints({width: 99999, height: 0, framerate: 500, audio: true, displaySurface: 'window'}), {video: {width: {ideal: 7680}, height: {ideal: 1080}, frameRate: {ideal: 240}, displaySurface: 'window'}, audio: true});
  assert.equal(createBrowserCaptureConstraints({displaySurface: 'unsupported'}).video.displaySurface, 'monitor');
});

test('microphone constraints are explicit, device-scoped, and configurable for noise suppression', () => { assert.deepEqual(createMicrophoneConstraints({deviceId: ' mic-1 ', noiseSuppression: false}), {echoCancellation: true, noiseSuppression: false, autoGainControl: true, deviceId: {exact: 'mic-1'}}); });

test('browser quality requests and sender parameters are bounded', () => {
  const quality = normalizeBrowserQualityRequest({profile: ' low ', bitrateKbps: 999999, maxFramerate: 0});
  assert.deepEqual(quality, {profile: 'low', maxWidth: 1920, maxHeight: 1080, bitrateKbps: 100000, maxFramerate: 60});
  assert.deepEqual(createVideoEncodingParameters({bitrateKbps: 2500, maxFramerate: 30}, {encodings: [{rid: 'main'}]}), {encodings: [{rid: 'main', maxBitrate: 2500000, maxFramerate: 30}]});
  assert.deepEqual(createVideoEncodingParameters({maxWidth: 1280, maxHeight: 720, bitrateKbps: 2500, maxFramerate: 30}, {encodings: [{rid: 'main'}]}, {width: 1920, height: 1080}), {encodings: [{rid: 'main', maxBitrate: 2500000, maxFramerate: 30, scaleResolutionDownBy: 1.5}]});
  assert.equal(createVideoEncodingParameters({}, {}), null);
});

test('browser publisher captures user-approved display media, answers offers, forwards ICE, and stops tracks', async () => {
  const listeners = {}; const stopped = []; const track = {addEventListener(type, handler) { listeners[type] = handler; }, stop() { stopped.push(true); }};
  const stream = {getTracks: () => [track]}; const calls = []; const peer = {connectionState: 'new', addTrack: (...args) => calls.push(['addTrack', ...args]), async setRemoteDescription(value) { calls.push(['remote', value]); }, async createAnswer() { return {type: 'answer', sdp: 'answer'}; }, async setLocalDescription(value) { calls.push(['local', value]); this.localDescription = value; }, async addIceCandidate(value) { calls.push(['ice', value]); }, close() { calls.push(['close']); }};
  const publisher = createBrowserWebRtcPublisher({createPeer: () => peer, mediaDevices: {async getDisplayMedia(constraints) { calls.push(['capture', constraints]); return stream; }}});
  const ice = []; publisher.on('icecandidate', candidate => ice.push(candidate));
  const captured = await publisher.capture({audio: true}); assert.equal(captured, stream); assert.equal(publisher.state, 'capturing'); assert.equal(calls[0][0], 'capture'); assert.equal(calls[1][0], 'addTrack');
  peer.onicecandidate({candidate: {candidate: 'candidate'}}); assert.deepEqual(ice, [{candidate: 'candidate'}]);
  const answer = await publisher.acceptOffer({type: 'offer', sdp: 'offer'}); assert.deepEqual(answer, {type: 'answer', sdp: 'answer'}); assert.equal(publisher.state, 'connected'); await publisher.addIceCandidate({candidate: 'remote'}); publisher.close(); assert.deepEqual(stopped, [true]); assert.equal(publisher.state, 'closed');
});

test('browser publisher requests microphone only when explicitly enabled and composes its track', async () => {
  const displayTrack = {stop() {}}; const microphoneTrack = {stop() {}}; const stream = {getTracks: () => [displayTrack, microphoneTrack], addTrack(track) { this.added = track; }, getAudioTracks: () => [microphoneTrack]}; const calls = []; const peer = {addTrack: (...args) => calls.push(args), close() {}};
  const publisher = createBrowserWebRtcPublisher({createPeer: () => peer, mediaDevices: {async getDisplayMedia() { return stream; }, async getUserMedia(constraints) { calls.push(['microphone', constraints]); return {getAudioTracks: () => [microphoneTrack]}; }}});
  await publisher.capture({microphone: true, microphoneDeviceId: 'mic-1', microphoneNoiseSuppression: false}); assert.equal(calls[0][0], 'microphone'); assert.deepEqual(calls[0][1].audio.deviceId, {exact: 'mic-1'}); assert.equal(calls[0][1].audio.noiseSuppression, false); assert.equal(calls.filter(call => call[0] === 'microphone').length, 1);
});

test('browser publisher applies quality requests to video sender encodings', async () => {
  const sender = {track: {kind: 'video', getSettings: () => ({width: 1920, height: 1080})}, getParameters: () => ({encodings: [{rid: 'main'}]}), async setParameters(parameters) { this.parameters = parameters; }};
  const peer = {getSenders: () => [sender], close() {}};
  const publisher = createBrowserWebRtcPublisher({createPeer: () => peer});
  const result = await publisher.applyQualityRequest({profile: 'high', bitrateKbps: 12000, maxFramerate: 90});
  assert.equal(result.status, 'applied'); assert.equal(result.appliedSenders, 1); assert.equal(sender.parameters.encodings[0].maxBitrate, 12000000); assert.equal(sender.parameters.encodings[0].maxFramerate, 90);
  assert.equal(sender.parameters.encodings[0].scaleResolutionDownBy, 1);
});

test('browser publisher reports unsupported quality controls without throwing', async () => {
  const publisher = createBrowserWebRtcPublisher({createPeer: () => ({getSenders: () => [{track: {kind: 'video'}, getParameters: () => ({})}], close() {}})});
  const result = await publisher.applyQualityRequest({profile: 'low'});
  assert.equal(result.status, 'unsupported'); assert.equal(result.appliedSenders, 0);
});

test('browser publisher gates captured tracks for pause and resume controls', async () => {
  const tracks = [{kind: 'video', enabled: true, stop() {}}, {kind: 'audio', enabled: true, stop() {}}];
  const peer = {addTrack() {}, close() {}};
  const publisher = createBrowserWebRtcPublisher({createPeer: () => peer, mediaDevices: {async getDisplayMedia() { return {getTracks: () => tracks}; }}});
  await publisher.capture();
  assert.equal(publisher.paused, false); assert.deepEqual(tracks.map(track => track.enabled), [true, true]);
  assert.equal(publisher.setPaused(true), true); assert.equal(publisher.paused, true); assert.deepEqual(tracks.map(track => track.enabled), [false, false]);
  assert.equal(publisher.setPaused(false), false); assert.equal(publisher.paused, false); assert.deepEqual(tracks.map(track => track.enabled), [true, true]);
});

test('browser publisher fails closed when capture is unavailable', async () => {
  const publisher = createBrowserWebRtcPublisher({createPeer: () => ({})});
  await assert.rejects(() => publisher.capture(), /Display capture is unavailable/);
});
