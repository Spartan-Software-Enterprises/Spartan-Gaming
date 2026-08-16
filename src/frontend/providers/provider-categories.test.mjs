import test from 'node:test';
import assert from 'node:assert/strict';
import {
  providerCategory,
  providerCategoryCounts,
  providersForCategory,
} from './provider-categories.mjs';

const providers = [
  { id: 'now', kind: 'cloud-gaming' },
  { id: 'host', kind: 'remote-play' },
  { id: 'twitch', kind: 'live-streaming' },
  { id: 'steam', kind: 'game-library' },
];

test('provider categories group services by the user task', () => {
  assert.equal(providerCategory(providers[0]), 'cloud');
  assert.equal(providerCategory(providers[1]), 'remote');
  assert.equal(providerCategory(providers[2]), 'streaming');
  assert.equal(providerCategory(providers[3]), 'libraries');
});

test('provider category filtering preserves catalog order and counts', () => {
  assert.deepEqual(
    providersForCategory(providers, 'cloud').map(({ id }) => id),
    ['now'],
  );
  assert.deepEqual(providerCategoryCounts(providers), {
    all: 4,
    cloud: 1,
    remote: 1,
    streaming: 1,
    libraries: 1,
  });
});
