import assert from 'node:assert/strict';
import test from 'node:test';
import {createSessionPreferences} from './preferences.mjs';

test('session preferences map streaming settings into bounded capabilities', () => {
  const result = createSessionPreferences({'streaming.resolution': '1440p', 'streaming.framerate': '120 FPS', 'streaming.codec': 'VP9', 'streaming.bitrate': 40, 'streaming.qualityPreset': 'Prefer latency', 'media.hdr': true, 'controllers.allowGamepad': false});
  assert.deepEqual(result.capabilities.video.codecs, ['vp9', 'h264']);
  assert.equal(result.capabilities.video.maxWidth, 2560);
  assert.equal(result.capabilities.video.maxFramerate, 120);
  assert.equal(result.capabilities.video.hdr, true);
  assert.equal(result.capabilities.input.gamepad, false);
  assert.equal(result.preferences.qualityPreset, 'low');
  assert.equal(result.preferences.bitrateKbps, 40000);
});

test('session preferences fall back safely for invalid settings', () => {
  const result = createSessionPreferences({'streaming.bitrate': 'not-a-number', 'streaming.framerate': 'bad', 'streaming.codec': 'unknown'});
  assert.equal(result.capabilities.video.maxWidth, 1920);
  assert.equal(result.capabilities.video.maxFramerate, 60);
  assert.deepEqual(result.capabilities.video.codecs, ['av1', 'vp9', 'h264']);
  assert.equal(result.preferences.bitrateKbps, 25000);
});
