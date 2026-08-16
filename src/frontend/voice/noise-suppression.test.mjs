import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildNoiseSuppressionConstraints,
  normalizeNoiseSuppressionPreference,
  resolveEffectiveNoiseSuppression,
} from './noise-suppression.mjs';

test('noise suppression normalizes unknown profiles to basic', () => {
  assert.equal(normalizeNoiseSuppressionPreference('aggressive'), 'aggressive');
  assert.equal(normalizeNoiseSuppressionPreference('ml'), 'ml');
  assert.equal(normalizeNoiseSuppressionPreference('off'), 'off');
  assert.equal(normalizeNoiseSuppressionPreference('loud'), 'basic');
  assert.equal(normalizeNoiseSuppressionPreference(undefined), 'basic');
  assert.equal(normalizeNoiseSuppressionPreference(''), 'basic');
});

test('noise suppression resolves supported profiles without downgrade', () => {
  const result = resolveEffectiveNoiseSuppression('aggressive', 'chromium');
  assert.equal(result.requested, 'aggressive');
  assert.equal(result.effective, 'aggressive');
  assert.equal(result.downgraded, false);
  assert.equal(result.reason, 'ok');
});

test('noise suppression steps ML down to the best supported profile', () => {
  const chromium = resolveEffectiveNoiseSuppression('ml', 'chromium');
  assert.equal(chromium.effective, 'aggressive');
  assert.equal(chromium.downgraded, true);
  assert.equal(chromium.reason, 'platform-capability-limited');

  const android = resolveEffectiveNoiseSuppression('ml', 'android');
  assert.equal(android.effective, 'basic');
  assert.equal(android.downgraded, true);

  const androidAggressive = resolveEffectiveNoiseSuppression('aggressive', 'android');
  assert.equal(androidAggressive.effective, 'basic');
  assert.equal(androidAggressive.downgraded, true);

  const unknown = resolveEffectiveNoiseSuppression('aggressive', 'edge');
  assert.equal(unknown.effective, 'basic');
  assert.equal(unknown.downgraded, true);
});

test('noise suppression keeps off available on every platform', () => {
  for (const platform of ['chromium', 'electron', 'android', 'firefox', 'unknown']) {
    const result = resolveEffectiveNoiseSuppression('off', platform);
    assert.equal(result.effective, 'off');
    assert.equal(result.downgraded, false);
  }
});

test('noise suppression builds bounded constraints per profile', () => {
  assert.deepEqual(buildNoiseSuppressionConstraints('off'), {
    noiseSuppression: false,
    echoCancellation: false,
    autoGainControl: false,
  });
  assert.deepEqual(buildNoiseSuppressionConstraints('basic'), {
    noiseSuppression: true,
    echoCancellation: false,
    autoGainControl: false,
  });
  assert.deepEqual(buildNoiseSuppressionConstraints('aggressive'), {
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: false,
  });
  assert.deepEqual(buildNoiseSuppressionConstraints('ml'), {
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: true,
  });
  assert.deepEqual(buildNoiseSuppressionConstraints('invalid'), {
    noiseSuppression: true,
    echoCancellation: false,
    autoGainControl: false,
  });
});
