// src/frontend/voice/transcription.mjs
const TRANSCRIPTION_MODES = Object.freeze(['off', 'local', 'adapter']);
const TRANSCRIPTION_LANGUAGES = Object.freeze([
  'automatic',
  'en',
  'es',
  'fr',
  'de',
  'ja',
  'ko',
  'zh',
]);
const MAX_TRANSCRIPT_SEGMENTS = 500;
const MAX_SEGMENT_LENGTH = 4096;

export function normalizeTranscriptionPreferences(raw) {
  if (!raw || typeof raw !== 'object')
    return { mode: 'off', language: 'automatic', showOverlay: false };
  const mode = TRANSCRIPTION_MODES.includes(raw.mode) ? raw.mode : 'off';
  const language = TRANSCRIPTION_LANGUAGES.includes(raw.language) ? raw.language : 'automatic';
  return { mode, language, showOverlay: raw.showOverlay === true };
}

export function resolveTranscriptionReadiness({
  preferences,
  sessionActive,
  microphonePermission,
  adapterAvailable,
}) {
  const prefs = normalizeTranscriptionPreferences(preferences);
  if (prefs.mode === 'off')
    return { status: 'disabled', reason: 'transcription-mode-off', ...prefs };
  if (!sessionActive) return { status: 'unavailable', reason: 'no-active-session', ...prefs };
  if (!microphonePermission)
    return { status: 'unavailable', reason: 'microphone-permission-missing', ...prefs };
  if (prefs.mode === 'adapter' && !adapterAvailable)
    return { status: 'unavailable', reason: 'official-transcription-adapter-required', ...prefs };
  return { status: 'ready', reason: 'ok', ...prefs };
}

export function sanitizeTranscriptSegment(segment) {
  if (!segment || typeof segment !== 'object' || typeof segment.text !== 'string') return null;
  const cleaned = segment.text.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (cleaned.length === 0) return null;
  return {
    text: cleaned.slice(0, MAX_SEGMENT_LENGTH),
    speaker: typeof segment.speaker === 'string' ? segment.speaker.slice(0, 64) : 'unknown',
    timestamp: Number.isFinite(segment.timestamp) ? segment.timestamp : 0,
  };
}

export function appendTranscriptSegment(buffer, segment) {
  const sanitized = sanitizeTranscriptSegment(segment);
  if (!sanitized) return Array.isArray(buffer) ? [...buffer] : [];
  const current = Array.isArray(buffer) ? buffer : [];
  const next = [...current, sanitized];
  return next.length > MAX_TRANSCRIPT_SEGMENTS
    ? next.slice(next.length - MAX_TRANSCRIPT_SEGMENTS)
    : next;
}

export function exportRedactedTranscript(buffer) {
  if (!Array.isArray(buffer) || buffer.length === 0)
    return { segments: [], count: 0, redacted: true };
  const speakerMap = new Map();
  let speakerCounter = 0;
  const segments = buffer.map((seg) => {
    if (!speakerMap.has(seg.speaker)) speakerMap.set(seg.speaker, `speaker-${++speakerCounter}`);
    return { text: seg.text, speaker: speakerMap.get(seg.speaker), timestamp: seg.timestamp };
  });
  return { segments, count: segments.length, redacted: true };
}
