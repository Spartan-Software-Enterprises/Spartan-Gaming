import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeRetentionCutoff,
  normalizeRecordingPreferences,
  pruneExpiredSegments,
  redactRecordingMetadata,
  resolveRecordingReadiness,
} from './recording.mjs';

test('recording preferences normalize to bounded values', () => {
  assert.deepEqual(normalizeRecordingPreferences(), {
    mode: 'off',
    retention: '7-days',
    includeAudio: false,
    includeOverlay: false,
  });
  assert.deepEqual(normalizeRecordingPreferences(null), {
    mode: 'off',
    retention: '7-days',
    includeAudio: false,
    includeOverlay: false,
  });
  assert.deepEqual(
    normalizeRecordingPreferences({
      mode: 'local',
      retention: '30-days',
      includeAudio: true,
      includeOverlay: true,
    }),
    { mode: 'local', retention: '30-days', includeAudio: true, includeOverlay: true },
  );
  assert.deepEqual(
    normalizeRecordingPreferences({ mode: 'cloud', retention: 'never', includeAudio: 'yes' }),
    { mode: 'off', retention: '7-days', includeAudio: false, includeOverlay: false },
  );
});

test('recording readiness fails closed for off mode', () => {
  const result = resolveRecordingReadiness({ preferences: { mode: 'off' } });
  assert.equal(result.status, 'disabled');
  assert.equal(result.reason, 'recording-mode-off');
});

test('recording readiness requires a session, display permission, and storage', () => {
  assert.equal(
    resolveRecordingReadiness({
      preferences: { mode: 'local' },
      sessionActive: false,
      displayPermission: true,
      storageAvailable: true,
    }).reason,
    'no-active-session',
  );
  assert.equal(
    resolveRecordingReadiness({
      preferences: { mode: 'local' },
      sessionActive: true,
      displayPermission: false,
      storageAvailable: true,
    }).reason,
    'display-permission-missing',
  );
  assert.equal(
    resolveRecordingReadiness({
      preferences: { mode: 'local' },
      sessionActive: true,
      displayPermission: true,
      storageAvailable: false,
    }).reason,
    'storage-unavailable',
  );
  const ready = resolveRecordingReadiness({
    preferences: { mode: 'local', retention: '1-day' },
    sessionActive: true,
    displayPermission: true,
    storageAvailable: true,
  });
  assert.equal(ready.status, 'ready');
  assert.equal(ready.reason, 'ok');
  assert.equal(ready.retention, '1-day');
});

test('recording retention computes bounded cutoffs', () => {
  const now = Date.now();
  assert.equal(computeRetentionCutoff('1-day', now), now - 86400000);
  assert.equal(computeRetentionCutoff('7-days', now), now - 604800000);
  assert.equal(computeRetentionCutoff('30-days', now), now - 2592000000);
  assert.equal(computeRetentionCutoff('manual', now), 0);
  assert.equal(computeRetentionCutoff('unknown', now), now - 604800000);
});

test('recording prunes expired segments by retention window', () => {
  const now = 1_000_000_000;
  const segments = [
    { timestamp: now },
    { timestamp: now - 500_000_000 },
    { timestamp: now - 1_000_000_000 },
    { timestamp: now - 2_000_000_000 },
  ];
  const oneDay = pruneExpiredSegments(segments, '1-day', now);
  assert.equal(oneDay.length, 1);
  const manual = pruneExpiredSegments(segments, 'manual', now);
  assert.equal(manual.length, 4);
  assert.deepEqual(pruneExpiredSegments(null, '7-days', now), []);
  assert.equal(pruneExpiredSegments(segments, '30-days', now).length, 4);
});

test('recording metadata redaction removes identifying fields', () => {
  assert.deepEqual(redactRecordingMetadata(), { redacted: true });
  assert.deepEqual(redactRecordingMetadata('junk'), { redacted: true });
  assert.deepEqual(
    redactRecordingMetadata({
      duration: 120,
      timestamp: 123,
      resolution: '1920x1080',
      includeAudio: true,
      includeOverlay: false,
      path: '/secret/location.mp4',
      name: 'player-name',
    }),
    {
      duration: 120,
      timestamp: 123,
      resolution: '1920x1080',
      includeAudio: true,
      includeOverlay: false,
      redacted: true,
    },
  );
});
