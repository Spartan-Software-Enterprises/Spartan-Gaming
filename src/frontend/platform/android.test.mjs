import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detectAndroidFormFactor,
  resolveAndroidGameModeIntent,
  resolveAndroidPolicy,
} from './android.mjs';
import './android-bridge.test.mjs';

test('Android form factor follows current window width and density', () => {
  assert.equal(detectAndroidFormFactor({ viewport: { width: 390 }, density: 1 }), 'phone');
  assert.equal(detectAndroidFormFactor({ viewport: { width: 1200 }, density: 2 }), 'tablet');
  assert.equal(
    detectAndroidFormFactor({
      viewport: { width: 1200 },
      density: 2,
      windowSegments: [{ width: 580 }, { width: 580 }],
    }),
    'foldable',
  );
  assert.equal(detectAndroidFormFactor(), 'unknown');
});

test('Android policy normalizes lifecycle, display, data, and Game Mode intents', () => {
  assert.deepEqual(
    resolveAndroidPolicy({
      formFactor: 'phone',
      orientation: 'landscape',
      settings: {
        'mobile.orientation': 'Landscape',
        'mobile.keepScreenAwake': true,
        'mobile.pictureInPicture': true,
        'mobile.edgeToEdge': true,
        'mobile.dataSaver': true,
        'mobile.gameMode': 'Performance',
        'accessibility.touchLayout': 'Full gamepad',
      },
    }),
    {
      formFactor: 'phone',
      orientation: 'landscape',
      currentOrientation: 'landscape',
      keepScreenAwake: true,
      pictureInPicture: true,
      edgeToEdge: true,
      dataSaver: true,
      gameMode: 'Performance',
      touchLayout: 'full gamepad',
    },
  );
});

test('Android policy fails closed for unknown settings and invalid form factors', () => {
  assert.deepEqual(
    resolveAndroidPolicy({ formFactor: 'watch', settings: { 'mobile.gameMode': 'turbo' } }),
    {
      formFactor: 'unknown',
      orientation: 'sensor',
      currentOrientation: 'unknown',
      keepScreenAwake: true,
      pictureInPicture: true,
      edgeToEdge: true,
      dataSaver: false,
      gameMode: 'Follow system',
      touchLayout: 'automatic',
    },
  );
});

test('Android Game Mode intent is query-only and refreshes on resume', () => {
  assert.deepEqual(
    resolveAndroidGameModeIntent({
      apiLevel: 34,
      requestedMode: 'Performance',
      observedMode: 'Performance',
    }),
    {
      apiLevel: 34,
      requestedMode: 'Performance',
      observedMode: 'Performance',
      supported: true,
      queryOnResume: true,
      appCanChangeMode: false,
      accepted: true,
    },
  );
  assert.equal(
    resolveAndroidGameModeIntent({
      apiLevel: 30,
      requestedMode: 'Battery',
      observedMode: 'Unsupported',
    }).supported,
    false,
  );
  assert.equal(
    resolveAndroidGameModeIntent({
      apiLevel: 35,
      requestedMode: 'Battery',
      observedMode: 'Performance',
    }).accepted,
    false,
  );
});
