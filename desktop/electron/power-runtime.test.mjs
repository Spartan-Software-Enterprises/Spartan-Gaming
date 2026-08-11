import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizePowerEvent,
  normalizePowerRuntimeState,
  resolveApplicationSessionActive,
  resolvePowerSaveBlockerType,
} from './power-runtime.mjs';

test('Electron power runtime normalizes bounded session and thermal state', () => {
  assert.deepEqual(
    normalizePowerRuntimeState({
      active: true,
      powerMode: 'Performance',
      onBattery: true,
      thermalState: 'serious',
      speedLimit: 140,
    }),
    {
      active: true,
      powerMode: 'Performance',
      onBattery: true,
      thermalState: 'serious',
      speedLimit: 100,
    },
  );
  assert.equal(normalizePowerRuntimeState({ powerMode: 'unsupported' }).powerMode, 'Balanced');
});

test('power save blocker follows active session and battery policy', () => {
  assert.equal(resolvePowerSaveBlockerType({ active: false, powerMode: 'Performance' }), null);
  assert.equal(
    resolvePowerSaveBlockerType({ active: true, powerMode: 'Performance' }),
    'prevent-display-sleep',
  );
  assert.equal(
    resolvePowerSaveBlockerType({ active: true, powerMode: 'Battery saver' }),
    'prevent-app-suspension',
  );
});

test('application activity includes auto-detected provider sessions', () => {
  assert.equal(resolveApplicationSessionActive(), false);
  assert.equal(resolveApplicationSessionActive({ gameSession: true }), true);
  assert.equal(resolveApplicationSessionActive({ providerSession: true }), true);
  assert.equal(
    resolveApplicationSessionActive({ gameSession: false, providerSession: false }),
    false,
  );
});

test('Electron power events expose only bounded diagnostic fields', () => {
  assert.deepEqual(normalizePowerEvent('on-battery'), { type: 'on-battery', onBattery: true });
  assert.deepEqual(normalizePowerEvent('thermal-state-change', { state: 'critical' }), {
    type: 'thermal-state-change',
    thermalState: 'critical',
  });
  assert.deepEqual(normalizePowerEvent('speed-limit-change', { limit: -20 }), {
    type: 'speed-limit-change',
    speedLimit: 0,
  });
});
