import assert from 'node:assert/strict';
import test from 'node:test';
import {detectAndroidFormFactor, resolveAndroidPolicy} from './android.mjs';

test('Android form factor follows current window width and density', () => {
  assert.equal(detectAndroidFormFactor({viewport: {width: 390}, density: 1}), 'phone');
  assert.equal(detectAndroidFormFactor({viewport: {width: 1200}, density: 2}), 'tablet');
  assert.equal(detectAndroidFormFactor({viewport: {width: 1200}, density: 2, windowSegments: [{width: 580}, {width: 580}]}), 'foldable');
  assert.equal(detectAndroidFormFactor(), 'unknown');
});

test('Android policy normalizes lifecycle, display, data, and Game Mode intents', () => {
  assert.deepEqual(resolveAndroidPolicy({formFactor: 'phone', orientation: 'landscape', settings: {
    'mobile.orientation': 'Landscape', 'mobile.keepScreenAwake': true, 'mobile.pictureInPicture': true,
    'mobile.edgeToEdge': true, 'mobile.dataSaver': true, 'mobile.gameMode': 'Performance',
    'accessibility.touchLayout': 'Full gamepad',
  }}), {
    formFactor: 'phone', orientation: 'landscape', currentOrientation: 'landscape', keepScreenAwake: true,
    pictureInPicture: true, edgeToEdge: true, dataSaver: true, gameMode: 'Performance', touchLayout: 'full gamepad',
  });
});

test('Android policy fails closed for unknown settings and invalid form factors', () => {
  assert.deepEqual(resolveAndroidPolicy({formFactor: 'watch', settings: {'mobile.gameMode': 'turbo'}}), {
    formFactor: 'unknown', orientation: 'sensor', currentOrientation: 'unknown', keepScreenAwake: true,
    pictureInPicture: true, edgeToEdge: true, dataSaver: false, gameMode: 'Follow system', touchLayout: 'automatic',
  });
});
