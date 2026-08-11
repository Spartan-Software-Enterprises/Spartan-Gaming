import assert from 'node:assert/strict';
import test from 'node:test';
import { detectRuntimePlatform, resolvePlatformCompatibility } from './compatibility.mjs';

test('runtime platform detection distinguishes Fire TV, Roku, Android, and desktop targets', () => {
  assert.equal(
    detectRuntimePlatform({
      userAgent: 'Mozilla/5.0 (Linux; U; Android 9; en-us; AFTSSS Build/PS7292)',
      navigatorRef: { platform: 'Linux armv7l' },
    }),
    'fire-tv',
  );
  assert.equal(
    detectRuntimePlatform({
      userAgent: 'Roku/DVP-12.5 (12.5.0. build 4178)',
      navigatorRef: { platform: 'Roku' },
    }),
    'roku',
  );
  assert.equal(
    detectRuntimePlatform({
      userAgent: 'Mozilla/5.0 (Linux; Android 15)',
      navigatorRef: { platform: 'Linux armv8l' },
    }),
    'android',
  );
  assert.equal(
    detectRuntimePlatform({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      navigatorRef: { platform: 'Win32' },
    }),
    'windows',
  );
});

test('Fire TV and Roku compatibility exposes shared web and remote-navigation gates', () => {
  for (const platform of ['fire-tv', 'roku']) {
    const profile = resolvePlatformCompatibility({
      platform,
      capabilities: { transports: { webrtc: true }, graphics: { webgl: true } },
    });
    assert.equal(profile.enginePolicy, 'chromium-capable');
    assert.equal(profile.gates.tvRemoteNavigation, true);
    assert.equal(profile.gates.remoteStreaming, true);
    assert.equal(profile.gates.browserEmulation, true);
    assert.equal(profile.gates.nativeHostPackaging, false);
  }
});
