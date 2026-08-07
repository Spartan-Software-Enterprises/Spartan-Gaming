import assert from 'node:assert/strict';
import test from 'node:test';
import {createBrowserCaptureConstraints, createBrowserWebRtcPublisher} from './browser-publisher.mjs';

test('browser capture constraints are bounded, explicit, and consent-safe', () => {
  assert.deepEqual(createBrowserCaptureConstraints({width: 99999, height: 0, framerate: 500, audio: true, displaySurface: 'window'}), {video: {width: {ideal: 7680}, height: {ideal: 1080}, frameRate: {ideal: 240}, displaySurface: 'window'}, audio: true});
  assert.equal(createBrowserCaptureConstraints({displaySurface: 'unsupported'}).video.displaySurface, 'monitor');
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

test('browser publisher fails closed when capture is unavailable', async () => {
  const publisher = createBrowserWebRtcPublisher({createPeer: () => ({})});
  await assert.rejects(() => publisher.capture(), /Display capture is unavailable/);
});
