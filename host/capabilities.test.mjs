import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hostMediaReady,
  normalizeHostCapabilities,
  resolveHostVideoCapabilities,
} from './capabilities.mjs';

test('host capabilities fail closed to an unconfigured media state', () => {
  const capabilities = normalizeHostCapabilities({
    media: { state: 'unknown' },
    process: { mode: 'unsafe' },
  });
  assert.equal(capabilities.media.state, 'not-configured');
  assert.equal(capabilities.process.mode, 'none');
  assert.equal(hostMediaReady(capabilities), false);
});
test('host capabilities report ready media and bounded adapter modes', () => {
  const capabilities = normalizeHostCapabilities({
    media: {
      state: 'ready',
      capture: true,
      encode: true,
      audio: true,
      transports: ['webrtc', 'webrtc'],
    },
    process: { mode: 'user-selected', launch: true },
    input: { gamepad: true, rumble: true },
  });
  assert.equal(capabilities.media.transports.length, 1);
  assert.equal(hostMediaReady(capabilities), true);
  assert.equal(capabilities.process.launch, true);
});
test('host capabilities expose optional WebRTC adapter state without module details', () => {
  const capabilities = normalizeHostCapabilities({
    webrtc: {
      adapters: [
        { id: 'werift', state: 'available', module: { secret: true } },
        { id: 'unknown', state: 'broken' },
      ],
    },
  });
  assert.deepEqual(capabilities.webrtc, {
    adapters: [{ id: 'werift', state: 'available' }],
    ready: true,
  });
});
test('host video capabilities advertise AV1 only when a hardware encoder confirms it', () => {
  const without = resolveHostVideoCapabilities({
    encoders: [{ codec: 'h264', encoder: 'h264_vaapi', device: '/dev/dri/renderD128' }],
  });
  assert.deepEqual(without.codecs, ['vp9', 'h264']);
  assert.deepEqual(without.hardware, [
    { codec: 'h264', encoder: 'h264_vaapi', device: '/dev/dri/renderD128' },
  ]);
  const withAv1 = resolveHostVideoCapabilities({
    encoders: [
      { codec: 'h264', encoder: 'h264_vaapi', device: '/dev/dri/renderD128' },
      { codec: 'av1', encoder: 'av1_vaapi', device: '/dev/dri/renderD128' },
    ],
  });
  assert.deepEqual(withAv1.codecs, ['av1', 'vp9', 'h264']);
});
test('host video capabilities cap to the display probe and stay HDR-honest', () => {
  const base = resolveHostVideoCapabilities({});
  assert.equal(base.hdr, false);
  assert.equal(base.maxFramerate, 144);
  const capped = resolveHostVideoCapabilities({
    maxFramerate: 240,
    display: { maxWidth: 1920, maxHeight: 1080, maxRefreshRate: 60, hdr: false },
  });
  assert.deepEqual([capped.maxWidth, capped.maxHeight, capped.maxFramerate], [1920, 1080, 60]);
  assert.equal(capped.hdr, false);
  const hdr = resolveHostVideoCapabilities({ hdr: true, display: { hdr: true } });
  assert.equal(hdr.hdr, true);
  const rejected = resolveHostVideoCapabilities({ hdr: true, display: { hdr: false } });
  assert.equal(rejected.hdr, false);
});
test('host video capabilities cap to a real X11 display descriptor shape', () => {
  const capped = resolveHostVideoCapabilities({
    maxFramerate: 240,
    display: { width: 1360, height: 768, maxRefreshRate: 60, count: 1, hdr: false },
  });
  assert.deepEqual([capped.maxWidth, capped.maxHeight, capped.maxFramerate], [1360, 768, 60]);
});
