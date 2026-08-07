import assert from 'node:assert/strict';
import test from 'node:test';
import {negotiateHostOffer} from './session.mjs';

const host = {transports: ['websocket'], video: {codecs: ['h264', 'vp9'], maxWidth: 3840, maxHeight: 2160, maxFramerate: 144, hdr: false}, audio: {codecs: ['opus'], channels: 2}, input: {gamepad: true, keyboard: true, pointer: true, rumble: true}};

test('host negotiation returns only the selected compatible contract', () => {
  const result = negotiateHostOffer({hostCapabilities: host, offer: {transports: ['webrtc', 'websocket'], video: {codecs: ['av1', 'h264'], maxWidth: 1920, maxHeight: 1080, maxFramerate: 60}, audio: {codecs: ['opus'], channels: 1}, input: {gamepad: true, keyboard: true, pointer: false, rumble: true}}});
  assert.equal(result.accepted, true); assert.deepEqual(result.capabilities.transports, ['websocket']); assert.deepEqual(result.capabilities.video.codecs, ['h264']); assert.equal(result.capabilities.video.maxWidth, 1920); assert.equal(result.capabilities.audio.channels, 1); assert.equal(result.capabilities.input.pointer, false);
});

test('host negotiation rejects an offer with no compatible transport', () => {
  const result = negotiateHostOffer({hostCapabilities: host, offer: {transports: ['webrtc'], video: {codecs: ['h264']}, audio: {codecs: ['opus']}}});
  assert.equal(result.accepted, false); assert.match(result.reason, /transport/); assert.equal('capabilities' in result, false);
});
