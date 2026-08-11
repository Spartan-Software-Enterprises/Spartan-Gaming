import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePowerState, resolvePowerQualityPolicy } from './power-policy.mjs';

test('power policy fails closed when battery telemetry is unavailable', () => {
  assert.deepEqual(normalizePowerState(), {
    mode: 'Balanced',
    batteryPercent: null,
    charging: false,
  });
  assert.equal(resolvePowerQualityPolicy().status, 'normal');
});

test('battery saver and low battery apply bounded handheld quality ceilings', () => {
  assert.deepEqual(resolvePowerQualityPolicy({ mode: 'Battery saver' }).limits, {
    maxWidth: 1280,
    maxHeight: 720,
    maxFramerate: 30,
    bitrateKbps: 6000,
  });
  assert.equal(resolvePowerQualityPolicy({ batteryPercent: 15 }).status, 'constrained');
  assert.deepEqual(resolvePowerQualityPolicy({ batteryPercent: 8 }).limits, {
    maxWidth: 960,
    maxHeight: 540,
    maxFramerate: 30,
    bitrateKbps: 3000,
  });
});

test('charging suppresses automatic low-battery caps without disabling explicit battery saver', () => {
  assert.equal(resolvePowerQualityPolicy({ batteryPercent: 8, charging: true }).status, 'normal');
  assert.equal(
    resolvePowerQualityPolicy({ mode: 'Battery saver', batteryPercent: 8, charging: true }).status,
    'constrained',
  );
  assert.equal(normalizePowerState({ mode: 'invalid', batteryPercent: 150 }).mode, 'Balanced');
  assert.equal(normalizePowerState({ mode: 'invalid', batteryPercent: 150 }).batteryPercent, 100);
});
