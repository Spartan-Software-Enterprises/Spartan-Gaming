export function normalizeSessionVolume(value, fallback = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return Math.max(0, Math.min(1, Number(fallback) || 0));
  return Math.max(0, Math.min(1, number));
}

export function formatSessionVolume(value) { return `${Math.round(normalizeSessionVolume(value) * 100)}%`; }

export function setSessionVolume(video, value) {
  if (!video || typeof video !== 'object') throw new TypeError('video target is required');
  const normalized = normalizeSessionVolume(value); video.volume = normalized; return normalized;
}
