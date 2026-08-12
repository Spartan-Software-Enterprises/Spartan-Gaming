import test from 'node:test';
import assert from 'node:assert/strict';
import { STREAM_SERVICE_IDS } from './streaming.mjs';

test('streaming module exports expected service ids', () => {
  assert.deepEqual(STREAM_SERVICE_IDS, [
    'twitch',
    'youtube-live',
    'kick',
    'steam-broadcasting',
    'discord',
  ]);
});

test('streaming module exposes setup and render functions', async () => {
  const module = await import('./streaming.mjs');
  assert.strictEqual(typeof module.setupStreamServices, 'function');
  assert.strictEqual(typeof module.renderStreamServices, 'function');
});

test('streaming service ids cover major platforms', () => {
  assert.ok(STREAM_SERVICE_IDS.includes('twitch'));
  assert.ok(STREAM_SERVICE_IDS.includes('youtube-live'));
  assert.ok(STREAM_SERVICE_IDS.includes('kick'));
  assert.ok(STREAM_SERVICE_IDS.includes('steam-broadcasting'));
  assert.ok(STREAM_SERVICE_IDS.includes('discord'));
  assert.strictEqual(STREAM_SERVICE_IDS.length, 5);
});
