import assert from 'node:assert/strict';
import test from 'node:test';
import {detectRuntimePlatform, resolvePlatformCompatibility} from './compatibility.mjs';

test('runtime platform detection distinguishes iPhone, desktop-mode iPadOS, Android, and desktop targets', () => {
  assert.equal(detectRuntimePlatform({userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', navigatorRef: {platform: 'iPhone'}}), 'ios');
  assert.equal(detectRuntimePlatform({userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', navigatorRef: {platform: 'MacIntel', maxTouchPoints: 5}}), 'ipados');
  assert.equal(detectRuntimePlatform({userAgent: 'Mozilla/5.0 (Linux; Android 15)', navigatorRef: {platform: 'Linux armv8l'}}), 'android');
  assert.equal(detectRuntimePlatform({userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', navigatorRef: {platform: 'Win32'}}), 'windows');
});

test('iOS compatibility fails closed to a WebKit-first profile without entitlements', () => {
  const profile = resolvePlatformCompatibility({platform: 'ios', distribution: 'app-store', capabilities: {transports: {webrtc: true}, graphics: {webgl: true}}});
  assert.equal(profile.enginePolicy, 'webkit-required');
  assert.equal(profile.supportLevel, 'web-first');
  assert.equal(profile.gates.nativeChromiumShell, false);
  assert.equal(profile.gates.remoteStreaming, true);
  assert.equal(profile.limitations.length, 2);
});

test('an explicitly entitled alternative-engine build is a separate iOS profile', () => {
  const profile = resolvePlatformCompatibility({platform: 'ipados', distribution: 'alternative-marketplace', alternativeEngineEntitled: true, capabilities: {graphics: {webgpu: true}}});
  assert.equal(profile.enginePolicy, 'alternative-engine-entitled');
  assert.equal(profile.supportLevel, 'platform-adapted');
  assert.equal(profile.gates.nativeChromiumShell, true);
  assert.equal(profile.gates.browserEmulation, true);
});
