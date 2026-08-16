import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendTranscriptSegment,
  exportRedactedTranscript,
  normalizeTranscriptionPreferences,
  resolveTranscriptionReadiness,
  sanitizeTranscriptSegment,
} from './transcription.mjs';

test('transcription preferences normalize to bounded values', () => {
  assert.deepEqual(normalizeTranscriptionPreferences(), {
    mode: 'off',
    language: 'automatic',
    showOverlay: false,
  });
  assert.deepEqual(normalizeTranscriptionPreferences(null), {
    mode: 'off',
    language: 'automatic',
    showOverlay: false,
  });
  assert.deepEqual(
    normalizeTranscriptionPreferences({ mode: 'adapter', language: 'es', showOverlay: true }),
    { mode: 'adapter', language: 'es', showOverlay: true },
  );
  assert.deepEqual(
    normalizeTranscriptionPreferences({ mode: 'loud', language: 'zz', showOverlay: 'yes' }),
    { mode: 'off', language: 'automatic', showOverlay: false },
  );
});

test('transcription readiness fails closed for off mode', () => {
  const result = resolveTranscriptionReadiness({ preferences: { mode: 'off' } });
  assert.equal(result.status, 'disabled');
  assert.equal(result.reason, 'transcription-mode-off');
});

test('transcription readiness requires an active session and microphone', () => {
  assert.equal(
    resolveTranscriptionReadiness({
      preferences: { mode: 'local' },
      sessionActive: false,
      microphonePermission: true,
    }).reason,
    'no-active-session',
  );
  assert.equal(
    resolveTranscriptionReadiness({
      preferences: { mode: 'local' },
      sessionActive: true,
      microphonePermission: false,
    }).reason,
    'microphone-permission-missing',
  );
});

test('transcription readiness requires an official adapter for adapter mode', () => {
  assert.equal(
    resolveTranscriptionReadiness({
      preferences: { mode: 'adapter' },
      sessionActive: true,
      microphonePermission: 'granted',
      adapterAvailable: false,
    }).reason,
    'official-transcription-adapter-required',
  );
  const ready = resolveTranscriptionReadiness({
    preferences: { mode: 'adapter' },
    sessionActive: true,
    microphonePermission: 'granted',
    adapterAvailable: true,
  });
  assert.equal(ready.status, 'ready');
  assert.equal(ready.reason, 'ok');
});

test('transcription sanitizes and bounds segments', () => {
  assert.equal(sanitizeTranscriptSegment(null), null);
  assert.equal(sanitizeTranscriptSegment({ text: '   ' }), null);
  assert.deepEqual(sanitizeTranscriptSegment({ text: 'hello\x00world\n' }), {
    text: 'helloworld',
    speaker: 'unknown',
    timestamp: 0,
  });
  const long = sanitizeTranscriptSegment({ text: 'x'.repeat(5000) });
  assert.equal(long.text.length, 4096);
});

test('transcription appends segments with a bounded buffer', () => {
  const first = appendTranscriptSegment([], { text: 'first', speaker: 'Alice', timestamp: 1 });
  assert.equal(first.length, 1);
  assert.equal(first[0].speaker, 'Alice');
  const second = appendTranscriptSegment(first, { text: 'second' });
  assert.equal(second.length, 2);
  assert.deepEqual(appendTranscriptSegment(first, null), first);
  const saturated = Array.from({ length: 500 }, (_, index) => ({
    text: `segment ${index}`,
    timestamp: index,
  }));
  const capped = appendTranscriptSegment(saturated, { text: 'overflow' });
  assert.equal(capped.length, 500);
  assert.equal(capped.at(-1).text, 'overflow');
});

test('transcription exports redacted speaker identities', () => {
  const empty = exportRedactedTranscript([]);
  assert.deepEqual(empty, { segments: [], count: 0, redacted: true });
  const result = exportRedactedTranscript([
    { text: 'hi', speaker: 'Alice', timestamp: 1 },
    { text: 'there', speaker: 'Alice', timestamp: 2 },
    { text: 'yo', speaker: 'Bob', timestamp: 3 },
  ]);
  assert.equal(result.count, 3);
  assert.equal(result.redacted, true);
  const speakers = result.segments.map((segment) => segment.speaker);
  assert.deepEqual(speakers, ['speaker-1', 'speaker-1', 'speaker-2']);
  assert.ok(!result.segments.some((segment) => /alice|bob/i.test(segment.speaker)));
});
