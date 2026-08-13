// src/frontend/session/recording.mjs
const RECORDING_MODES = Object.freeze(['off', 'local']);
const RECORDING_RETENTION_OPTIONS = Object.freeze(['1-day', '7-days', '30-days', 'manual']);

export function normalizeRecordingPreferences(raw) {
  if (!raw || typeof raw !== 'object')
    return { mode: 'off', retention: '7-days', includeAudio: false, includeOverlay: false };
  const mode = RECORDING_MODES.includes(raw.mode) ? raw.mode : 'off';
  const retention = RECORDING_RETENTION_OPTIONS.includes(raw.retention) ? raw.retention : '7-days';
  return {
    mode,
    retention,
    includeAudio: raw.includeAudio === true,
    includeOverlay: raw.includeOverlay === true,
  };
}

export function resolveRecordingReadiness({
  preferences,
  sessionActive,
  displayPermission,
  storageAvailable,
}) {
  const prefs = normalizeRecordingPreferences(preferences);
  if (prefs.mode === 'off') return { status: 'disabled', reason: 'recording-mode-off', ...prefs };
  if (!sessionActive) return { status: 'unavailable', reason: 'no-active-session', ...prefs };
  if (!displayPermission)
    return { status: 'unavailable', reason: 'display-permission-missing', ...prefs };
  if (!storageAvailable) return { status: 'unavailable', reason: 'storage-unavailable', ...prefs };
  return { status: 'ready', reason: 'ok', ...prefs };
}

export function computeRetentionCutoff(retention, now = Date.now()) {
  const retentionMs = {
    '1-day': 86400000,
    '7-days': 604800000,
    '30-days': 2592000000,
    manual: Infinity,
  };
  const window = retentionMs[retention] ?? retentionMs['7-days'];
  return !Number.isFinite(window) ? 0 : now - window;
}

export function pruneExpiredSegments(segments, retention, now = Date.now()) {
  if (!Array.isArray(segments)) return [];
  const cutoff = computeRetentionCutoff(retention, now);
  if (cutoff === 0) return [...segments];
  return segments.filter(
    (seg) =>
      seg &&
      typeof seg === 'object' &&
      (Number.isFinite(seg.timestamp) ? seg.timestamp : 0) >= cutoff,
  );
}

export function redactRecordingMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return { redacted: true };
  return {
    duration: Number.isFinite(metadata.duration) ? metadata.duration : 0,
    timestamp: Number.isFinite(metadata.timestamp) ? metadata.timestamp : 0,
    resolution: typeof metadata.resolution === 'string' ? metadata.resolution : 'unknown',
    includeAudio: metadata.includeAudio === true,
    includeOverlay: metadata.includeOverlay === true,
    redacted: true,
  };
}
