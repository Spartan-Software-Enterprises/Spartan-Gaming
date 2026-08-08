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
  assert.equal(result.preferences.qualityProfiles.find(profile => profile.id === 'high').maxWidth, 2560);
  assert.equal(result.preferences.autoFullscreen, true);
  assert.equal(result.preferences.pictureInPicture, true);
  assert.equal(result.preferences.showOverlay, true);
});

test('session preferences fall back safely for invalid settings', () => {
  const result = createSessionPreferences({'streaming.bitrate': 'not-a-number', 'streaming.framerate': 'bad', 'streaming.codec': 'unknown'});
  assert.equal(result.capabilities.video.maxWidth, 1920);
  assert.equal(result.capabilities.video.maxFramerate, 60);
  assert.deepEqual(result.capabilities.video.codecs, ['av1', 'vp9', 'h264']);
  assert.equal(result.preferences.bitrateKbps, 25000);
  assert.equal(result.preferences.qualityProfiles.find(profile => profile.id === 'ultra').maxWidth, 1920);
  assert.equal(result.preferences.autoFullscreen, true);
});
test('session preferences carry bounded display selection and refresh policy', () => { const result = createSessionPreferences({'media.display': 'Display 2', 'media.refreshRate': '240 Hz'}); assert.deepEqual(result.preferences.display, {kind: 'index', index: 1}); assert.equal(result.preferences.maxRefreshRate, 240); const ask = createSessionPreferences({'media.display': 'Ask each time', 'media.refreshRate': 'Automatic'}); assert.equal(ask.preferences.display, 'ask'); assert.equal(ask.preferences.maxRefreshRate, null); });
test('session preferences carry the touch-control layout choice', () => { assert.equal(createSessionPreferences({'accessibility.touchLayout': 'Minimal'}).preferences.touchLayout, 'Minimal'); });
test('session preferences honor the Picture-in-Picture setting', () => { assert.equal(createSessionPreferences({'gaming.pictureInPicture': false}).preferences.pictureInPicture, false); });
test('session preferences carry telemetry visibility and bounded game volume', () => { const result = createSessionPreferences({'streaming.showTelemetry': true, 'media.gameVolume': 35}); assert.equal(result.preferences.showTelemetry, true); assert.equal(result.preferences.gameVolume, 0.35); assert.equal(createSessionPreferences({'media.gameVolume': 150}).preferences.gameVolume, 1); });
test('session preferences carry controller layout and bounded dead-zone settings', () => { const result = createSessionPreferences({'controllers.defaultProfile': 'PlayStation layout', 'controllers.deadzone': 20}); assert.equal(result.preferences.controllerProfile, 'PlayStation layout'); assert.equal(result.preferences.controllerDeadzone, 0.2); assert.equal(result.preferences.controllerBindings.confirm, 'button-1'); assert.equal(createSessionPreferences({'controllers.deadzone': 100}).preferences.controllerDeadzone, 0.3); });
test('session preferences carry the bounded instant replay policy', () => { const result = createSessionPreferences({'gaming.instantReplay': true, 'gaming.replayLength': '120 seconds'}); assert.equal(result.preferences.instantReplay, true); assert.equal(result.preferences.replayLengthSeconds, 120); assert.equal(createSessionPreferences({'gaming.replayLength': 'invalid'}).preferences.replayLengthSeconds, 30); });
test('session preferences carry the focus pause policy', () => { assert.equal(createSessionPreferences({'gaming.pauseOnBlur': true}).preferences.pauseOnBlur, true); assert.equal(createSessionPreferences().preferences.pauseOnBlur, false); });
test('session preferences apply observed display policy evidence without storing capabilities', () => { const result = createSessionPreferences({'media.hdr': true, 'media.refreshRate': '240 Hz', 'streaming.codec': 'Automatic'}, {graphics: {hdr: false}, display: {maxRefreshRate: 144}, media: {codecs: {av1: false, vp9: true, h264: true}}}); assert.equal(result.capabilities.video.hdr, false); assert.equal(result.capabilities.video.maxFramerate, 144); assert.deepEqual(result.capabilities.video.codecs, ['vp9', 'h264']); assert.equal(result.preferences.displayPolicy.maxRefreshRate, 144); });
