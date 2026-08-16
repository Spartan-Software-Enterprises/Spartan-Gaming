import test from 'node:test';
import assert from 'node:assert/strict';
import { discoveryOptions, matchesDiscovery, searchSuggestions } from './discovery.mjs';

const entries = [
  {
    id: 'cloud',
    name: 'Cloud Arcade',
    backendType: 'provider',
    systems: ['PC'],
    capabilities: ['gamepad', 'keyboard'],
  },
  {
    id: 'emu',
    name: 'Retro Core',
    backendType: 'emulator',
    systems: ['PlayStation 2'],
    capabilities: ['gamepad'],
  },
];

const adapters = {
  get(id) {
    return {
      resolve: () => ({
        readiness: { status: id === 'cloud' ? 'ready' : 'configuration-required' },
      }),
    };
  },
};

test('discovery options are derived from catalog metadata', () => {
  assert.deepEqual(discoveryOptions(entries), {
    providers: ['Cloud Arcade'],
    platforms: ['PC', 'PlayStation 2'],
    inputs: ['gamepad', 'keyboard'],
    readiness: [
      ['ready', 'Ready'],
      ['configuration-required', 'Setup required'],
      ['native-adapter-required', 'Native adapter'],
      ['browser-capability-missing', 'Capability missing'],
      ['checking', 'Checking'],
    ],
  });
});

test('discovery matching composes search, metadata, and readiness filters', () => {
  assert.equal(
    matchesDiscovery(
      entries[0],
      {
        search: 'arc',
        provider: 'Cloud Arcade',
        platform: 'PC',
        input: 'gamepad',
        readiness: 'ready',
      },
      adapters,
    ),
    true,
  );
  assert.equal(matchesDiscovery(entries[1], { readiness: 'ready' }, adapters), false);
  assert.equal(matchesDiscovery(entries[0], { platform: 'PlayStation 2' }, adapters), false);
});

test('search suggestions are bounded, unique, and query-aware', () => {
  assert.deepEqual(searchSuggestions(entries, 'game'), ['gamepad']);
  assert.equal(searchSuggestions(entries, '', 2).length, 2);
});
