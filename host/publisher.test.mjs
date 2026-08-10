import assert from 'node:assert/strict';
import test from 'node:test';
import {createCapturePlan, createEncoderPlan} from './media.mjs';
import {createMediaPublisherPlan, normalizePublisherCapabilities, publisherIsReady} from './publisher.mjs';

test('publisher capabilities fail closed until native media is configured', () => {
  const publisher = normalizePublisherCapabilities({});
  assert.equal(publisher.state, 'unconfigured');
  assert.equal(publisherIsReady(publisher), false);
  assert.deepEqual(publisher.requires, ['native-capture-adapter', 'webrtc-publisher']);
});

test('publisher plan composes capture and encoder plans without executing processes', () => {
  const capture = createCapturePlan({platform: 'linux', sourceType: 'x11', source: ':0.0', environment: {DISPLAY: ':0'}});
  const encoder = createEncoderPlan({codec: 'h264', width: 1280, height: 720, framerate: 60, bitrateKbps: 6000});
  const plan = createMediaPublisherPlan({capturePlan: capture, encoderPlan: encoder});
  assert.equal(plan.state, 'plan-only');
  assert.equal(plan.ready, false);
  assert.equal(plan.encoder.codec, 'h264');
  assert.equal(plan.capture.process.shell, false);
});

test('publisher capabilities retain bounded negotiated limits', () => {
  const publisher = normalizePublisherCapabilities({state: 'ready', transports: ['invalid', 'webrtc'], video: {codecs: ['invalid', 'vp9'], maxWidth: 99999, maxFramerate: 999}, audio: {channels: 99}});
  assert.deepEqual(publisher.transports, ['webrtc']);
  assert.deepEqual(publisher.video.codecs, ['vp9']);
  assert.equal(publisher.video.maxWidth, 7680);
  assert.equal(publisher.video.maxFramerate, 240);
  assert.equal(publisher.audio.channels, 8);
  assert.equal(publisherIsReady(publisher), true);
});
