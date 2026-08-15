import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBandwidthUsage,
  createCloudGameDeepLink,
  getCloudStreamPreset,
  listCloudStreamPresets,
  probeProviderRegionLatency,
  selectOptimalCloudRegion,
} from './cloud-features.mjs';

test('cloud stream presets provide normalized specifications and bandwidth per hour', () => {
  const defaultPreset = getCloudStreamPreset();
  assert.equal(defaultPreset.id, 'balanced-1080p60');
  assert.equal(defaultPreset.width, 1920);
  assert.equal(defaultPreset.height, 1080);
  assert.equal(defaultPreset.framerate, 60);

  const ultraPreset = getCloudStreamPreset('ultra-4k60');
  assert.equal(ultraPreset.width, 3840);
  assert.equal(ultraPreset.bitrateKbps, 45000);
  assert.equal(ultraPreset.dataUsageGbPerHour, 20.25);

  const presets = listCloudStreamPresets();
  assert.ok(presets.length >= 5);
  assert.ok(presets.some((p) => p.id === 'ultra-low-latency-720p60'));
});

test('calculateBandwidthUsage computes accurate MB and GB usage for cloud gaming sessions', () => {
  const usage60m = calculateBandwidthUsage({ bitrateKbps: 12000, durationMinutes: 60 });
  assert.equal(usage60m.totalMb, 5149.84);
  assert.equal(usage60m.totalGb, 5.03);

  const usage30m = calculateBandwidthUsage({ bitrateKbps: 5000, durationMinutes: 30 });
  assert.equal(usage30m.totalMb, 1072.88);
  assert.equal(usage30m.totalGb, 1.05);

  const fallback = calculateBandwidthUsage({ bitrateKbps: -100, durationMinutes: 0 });
  assert.equal(fallback.bitrateKbps, 250);
  assert.equal(fallback.durationMinutes, 1);
});

test('createCloudGameDeepLink builds official deep link URLs for cloud providers', () => {
  const xboxLink = createCloudGameDeepLink('xbox-cloud-gaming', 'Halo Infinite');
  assert.equal(xboxLink, 'https://www.xbox.com/play/games/halo-infinite');

  const gfnLink = createCloudGameDeepLink('nvidia-geforce-now', '1004921');
  assert.equal(gfnLink, 'https://play.geforcenow.com/mall/#/deep-link?game-id=1004921');

  const lunaLink = createCloudGameDeepLink('amazon-luna', 'Fortnite');
  assert.equal(lunaLink, 'https://luna.amazon.com/game/fortnite');

  const boosteroidLink = createCloudGameDeepLink('boosteroid', 'Cyberpunk 2077');
  assert.equal(boosteroidLink, 'https://boosteroid.com/desktop?game=cyberpunk-2077');

  assert.equal(createCloudGameDeepLink('unknown-provider', 'Game'), null);
  assert.equal(createCloudGameDeepLink('xbox-cloud-gaming', ''), null);
  assert.equal(createCloudGameDeepLink(null, 'Game'), null);
});

test('probeProviderRegionLatency measures network latency to cloud regional endpoints', async () => {
  const fakeFetch = () => Promise.resolve({ ok: true });
  const result = await probeProviderRegionLatency({
    endpointUrl: 'https://westus.cloudgaming.xbox.com/ping',
    fetchImpl: fakeFetch,
  });
  assert.equal(result.success, true);
  assert.ok(typeof result.latencyMs === 'number');

  const errorFetch = () => Promise.reject(new Error('connection failed'));
  const errorResult = await probeProviderRegionLatency({
    endpointUrl: 'https://invalid.endpoint/ping',
    fetchImpl: errorFetch,
  });
  assert.equal(errorResult.success, false);
  assert.equal(errorResult.latencyMs, null);
  assert.equal(errorResult.reason, 'connection failed');
});

test('selectOptimalCloudRegion selects the region with lowest latency', () => {
  const regionData = {
    'north-america': { success: true, latencyMs: 25 },
    europe: { success: true, latencyMs: 110 },
    'asia-pacific': { success: true, latencyMs: 185 },
    'latin-america': { success: false, latencyMs: null },
  };

  const optimal = selectOptimalCloudRegion(regionData);
  assert.equal(optimal.optimalRegion, 'north-america');
  assert.equal(optimal.lowestLatencyMs, 25);

  const fallback = selectOptimalCloudRegion({});
  assert.equal(fallback.optimalRegion, 'automatic');
  assert.equal(fallback.lowestLatencyMs, null);
});
