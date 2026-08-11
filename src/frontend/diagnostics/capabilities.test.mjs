import test from 'node:test';
import assert from 'node:assert/strict';
import { collectCapabilities, redactDiagnostics, recommendCapabilities } from './capabilities.mjs';

test('capability probe normalizes browser APIs without requiring Chromium globals', async () => {
  const report = await collectCapabilities({
    navigatorLike: {
      userAgentData: { brands: [{ brand: 'Chromium', version: '1' }], platform: 'Linux' },
      getGamepads: () => [],
      maxTouchPoints: 0,
      hardwareConcurrency: 8,
      WebTransport: class {},
      WebSocket: class {},
      mediaDevices: {},
    },
    rtcPeerConnection: class {},
    mediaSourceLike: { isTypeSupported: (mime) => mime.includes('avc1') },
    videoDecoderLike: class {},
    now: () => 'now',
  });
  assert.equal(report.browser.engine, 'chromium');
  assert.equal(report.transports.webrtc, true);
  assert.equal(report.media.codecs.h264, true);
});
test('capability probe records per-codec hardware efficiency signals', async () => {
  const report = await collectCapabilities({
    navigatorLike: {
      mediaCapabilities: {
        decodingInfo: async ({ video }) => ({
          supported: video.contentType.includes('avc1'),
          smooth: true,
          powerEfficient: video.contentType.includes('avc1'),
        }),
      },
    },
    mediaSourceLike: { isTypeSupported: () => true },
    videoDecoderLike: class {},
  });
  assert.equal(report.media.hardwareDecode.h264.powerEfficient, true);
  assert.equal(report.media.hardwareDecode.vp9.supported, false);
});
test('recommendations identify missing critical capabilities', () => {
  const recommendations = recommendCapabilities({
    transports: { webrtc: false },
    graphics: { webgpu: false, webgl: false },
    media: { hardwareDecodeApi: false, codecs: { av1: false, vp9: false, h264: false } },
    input: { gamepad: false },
  });
  assert.equal(
    recommendations.some((item) => item.key === 'webrtc' && item.severity === 'error'),
    true,
  );
  assert.equal(
    recommendations.some((item) => item.key === 'codecs'),
    true,
  );
});
test('diagnostic export excludes platform identity detail', async () => {
  const report = await collectCapabilities({
    navigatorLike: { platform: 'Windows', getGamepads: () => [] },
    rtcPeerConnection: class {},
    now: () => 'now',
  });
  const redacted = redactDiagnostics(report);
  assert.equal(redacted.browser.platform, undefined);
  assert.equal(redacted.browser.engine, 'unknown');
});
test('capability probe reports HDR and multi-display capability without screen identity', async () => {
  const report = await collectCapabilities({
    navigatorLike: {
      getScreenDetails: async () => ({
        screens: [
          { width: 1920, height: 1080, refreshRate: 144 },
          { width: 2560, height: 1440, refreshRate: 60 },
        ],
      }),
    },
    screenLike: { isExtended: true },
    matchMediaLike: (query) => ({ matches: query.includes('dynamic-range') }),
    now: () => 'now',
  });
  assert.equal(report.display.count, 2);
  assert.equal(report.display.extended, true);
  assert.equal(report.display.maxRefreshRate, 144);
  assert.equal(report.graphics.hdr, true);
  assert.equal(report.display.displays[0].refreshRate, 144);
  assert.equal(report.display.displays[0].label, undefined);
});
test('capability probe records whether Screen Details can support targeted fullscreen', async () => {
  const report = await collectCapabilities({
    navigatorLike: { getScreenDetails: async () => ({ screens: [] }) },
  });
  assert.equal(report.display.screenDetails, true);
});
