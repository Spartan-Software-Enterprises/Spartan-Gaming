import assert from 'node:assert/strict';
import test from 'node:test';
import { preparePlayerSession } from './preflight.mjs';

const storage = {
  getItem: () =>
    JSON.stringify({
      'media.hdr': true,
      'media.refreshRate': '240 Hz',
      'streaming.codec': 'Automatic',
    }),
};

test('player preflight applies browser capability evidence before negotiation', async () => {
  const result = await preparePlayerSession({
    storage,
    collect: async () => ({
      graphics: { hdr: false },
      display: { maxRefreshRate: 144 },
      media: { codecs: { av1: false, vp9: true, h264: true } },
    }),
  });
  assert.equal(result.preferences.capabilities.video.hdr, false);
  assert.equal(result.preferences.capabilities.video.maxFramerate, 144);
  assert.deepEqual(result.preferences.capabilities.video.codecs, ['vp9', 'h264']);
  assert.equal(result.inputPolicy.allows('gamepad'), true);
});

test('player preflight remains usable when capability probing fails', async () => {
  const result = await preparePlayerSession({
    storage,
    collect: async () => {
      throw new Error('probe unavailable');
    },
  });
  assert.equal(result.capabilities, null);
  assert.equal(result.preferences.capabilities.video.hdr, true);
  assert.deepEqual(result.preferences.capabilities.video.codecs, ['av1', 'vp9', 'h264']);
});
