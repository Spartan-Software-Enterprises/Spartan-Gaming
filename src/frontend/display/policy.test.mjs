import assert from 'node:assert/strict';
import test from 'node:test';
import {resolveDisplayPolicy} from './policy.mjs';

test('display policy caps refresh, disables unsupported HDR, and filters evidenced codecs', () => {
  const policy = resolveDisplayPolicy({
    settings: {'streaming.resolution': '4K', 'streaming.codec': 'Automatic', 'media.hdr': true, 'media.refreshRate': '240 Hz', 'media.display': 'Display 2'},
    capabilities: {graphics: {hdr: false}, display: {count: 1, extended: false, maxRefreshRate: 144}, media: {codecs: {av1: false, vp9: true, h264: true}}},
  });
  assert.deepEqual(policy.resolution, {width: 3840, height: 2160});
  assert.equal(policy.maxRefreshRate, 144);
  assert.equal(policy.hdr, false);
  assert.deepEqual(policy.codecs, ['vp9', 'h264']);
  assert.equal(policy.warnings.length, 3);
});

test('display policy preserves safe requested defaults when capability evidence is unavailable', () => {
  const policy = resolveDisplayPolicy({settings: {'streaming.codec': 'VP9', 'media.refreshRate': '120 FPS', 'media.hdr': true, 'media.display': 'Ask each time'}});
  assert.equal(policy.maxRefreshRate, null);
  assert.deepEqual(policy.codecs, ['vp9', 'h264']);
  assert.equal(policy.hdr, true);
  assert.deepEqual(policy.display, 'ask');
  assert.deepEqual(policy.warnings, []);
});

test('display policy fails closed for invalid display selections and refresh values', () => {
  const policy = resolveDisplayPolicy({settings: {'media.display': 'Display x', 'media.refreshRate': 'not-a-rate', 'streaming.resolution': 'invalid'}, capabilities: {display: {count: 2, maxRefreshRate: 60}}});
  assert.deepEqual(policy.display, 'automatic');
  assert.equal(policy.maxRefreshRate, 60);
  assert.deepEqual(policy.resolution, {width: 1920, height: 1080});
});
