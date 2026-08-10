import assert from 'node:assert/strict';
import test from 'node:test';
import {detectDeviceMode, resolveDeviceMode, resolvePresentationProfile} from './device-mode.mjs';

test('device mode detection distinguishes television, ChromeOS, handheld, mobile, and desktop signals', () => {
  assert.equal(detectDeviceMode({userAgent: 'Mozilla/5.0 SmartTV Tizen'}), 'television');
  assert.equal(detectDeviceMode({userAgent: 'Mozilla/5.0 CrOS x86_64'}), 'chromeos');
  assert.equal(detectDeviceMode({userAgent: 'Mozilla/5.0 Android', viewport: {width: 900}}), 'handheld');
  assert.equal(detectDeviceMode({userAgent: 'Mozilla/5.0 iPhone', viewport: {width: 390}}), 'mobile');
  assert.equal(detectDeviceMode({navigatorRef: {maxTouchPoints: 5}, userAgent: 'Mozilla/5.0 Macintosh', viewport: {width: 1024}}), 'handheld');
  assert.equal(detectDeviceMode({userAgent: 'Mozilla/5.0 Windows NT 10.0'}), 'desktop');
});

test('presentation profiles remain explicit and settings can force a target mode', () => {
  assert.equal(resolveDeviceMode({settings: {'appearance.deviceMode': 'Television'}, detectedMode: 'desktop'}), 'television');
  assert.equal(resolveDeviceMode({settings: {'appearance.deviceMode': 'Automatic'}, detectedMode: 'mobile'}), 'mobile');
  const profile = resolvePresentationProfile({settings: {'appearance.uiScale': 100}, detectedMode: 'television', viewport: {width: 1920}});
  assert.deepEqual(profile, {mode: 'television', navigation: 'remote-controller', touchControls: false, preferFullscreen: true, focusScale: 1.2, columns: 4, narrowViewport: false, effectiveUiScale: 120});
});

test('invalid device signals fail closed to desktop', () => {
  assert.equal(resolveDeviceMode({settings: {'appearance.deviceMode': 'invalid'}, detectedMode: 'unknown'}), 'desktop');
  assert.equal(resolvePresentationProfile({settings: {}, detectedMode: 'unknown'}).mode, 'desktop');
});
