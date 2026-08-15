import test from 'node:test';
import assert from 'node:assert/strict';
import { STREAM_SERVICE_IDS } from '../social/streaming.mjs';

const mockProviderEntries = [
  { id: 'twitch', name: 'Twitch', kind: 'live-streaming', description: 'Twitch streaming' },
  {
    id: 'youtube-live',
    name: 'YouTube Live',
    kind: 'live-streaming',
    description: 'YouTube streaming',
  },
  { id: 'kick', name: 'Kick', kind: 'live-streaming', description: 'Kick streaming' },
  {
    id: 'steam-broadcasting',
    name: 'Steam Broadcasting',
    kind: 'social-streaming',
    description: 'Steam streaming',
  },
  { id: 'discord', name: 'Discord', kind: 'social-streaming', description: 'Discord' },
  { id: 'steam-library', name: 'Steam', kind: 'game-library', description: 'Steam games' },
];

test('watch page filters all streaming services', () => {
  const all = mockProviderEntries.filter((entry) => STREAM_SERVICE_IDS.includes(entry.id));
  assert.strictEqual(all.length, 5);
});

test('watch page filters live streaming services', () => {
  const live = mockProviderEntries.filter(
    (entry) => STREAM_SERVICE_IDS.includes(entry.id) && entry.kind === 'live-streaming',
  );
  assert.strictEqual(live.length, 3);
  assert.ok(live.every((entry) => entry.kind === 'live-streaming'));
});

test('watch page filters social streaming services', () => {
  const social = mockProviderEntries.filter(
    (entry) => STREAM_SERVICE_IDS.includes(entry.id) && entry.kind === 'social-streaming',
  );
  assert.strictEqual(social.length, 2);
  assert.ok(social.every((entry) => entry.kind === 'social-streaming'));
});

test('watch page excludes non-streaming services', () => {
  const filtered = mockProviderEntries.filter((entry) => STREAM_SERVICE_IDS.includes(entry.id));
  const nonStreaming = filtered.filter((entry) => entry.kind === 'game-library');
  assert.strictEqual(nonStreaming.length, 0);
});
