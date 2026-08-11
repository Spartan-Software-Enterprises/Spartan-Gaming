function tracks(stream, kind) {
  return typeof stream?.getTracks === 'function'
    ? stream.getTracks().filter((track) => track?.kind === kind)
    : [];
}

const CAPTION_MODES = new Set(['Off', 'On']);
const CAPTION_LANGUAGES = new Set([
  'Automatic',
  'English',
  'Spanish',
  'French',
  'German',
  'Japanese',
]);
const CAPTION_LANGUAGE_CODES = Object.freeze({
  English: 'en',
  Spanish: 'es',
  French: 'fr',
  German: 'de',
  Japanese: 'ja',
});

export function normalizeCaptionPreference({ mode = 'Off', language = 'Automatic' } = {}) {
  return Object.freeze({
    mode: CAPTION_MODES.has(mode) ? mode : 'Off',
    language: CAPTION_LANGUAGES.has(language) ? language : 'Automatic',
  });
}

/** Select one safe WebVTT/text track and disable all competing tracks. */
export function applyCaptionPreference(video, preference = {}) {
  if (!video || typeof video !== 'object') throw new TypeError('video target is required');
  const normalized = normalizeCaptionPreference(preference);
  const list = video.textTracks;
  if (!list || typeof list.length !== 'number')
    return Object.freeze({ supported: false, active: null, preference: normalized });
  const available = Array.from({ length: list.length }, (_, index) => list[index]).filter(Boolean);
  available.forEach((track) => {
    track.mode = 'disabled';
  });
  if (normalized.mode === 'Off')
    return Object.freeze({ supported: true, active: null, preference: normalized });
  const language =
    normalized.language === 'Automatic' ? null : CAPTION_LANGUAGE_CODES[normalized.language];
  const candidates = available.filter((track) =>
    ['captions', 'subtitles'].includes(String(track.kind || '').toLowerCase()),
  );
  const selected =
    candidates.find(
      (track) =>
        language &&
        String(track.language || track.srclang || '')
          .toLowerCase()
          .startsWith(language),
    ) ||
    candidates.find((track) => track.default) ||
    candidates[0] ||
    null;
  if (selected) selected.mode = 'showing';
  return Object.freeze({
    supported: true,
    active: selected
      ? String(
          selected.language || selected.srclang || selected.label || selected.kind || 'default',
        )
      : null,
    preference: normalized,
  });
}

export function describeMediaStream(stream) {
  const videoTracks = tracks(stream, 'video');
  const audioTracks = tracks(stream, 'audio');
  return Object.freeze({
    videoTracks: videoTracks.length,
    audioTracks: audioTracks.length,
    hasVideo: videoTracks.length > 0,
    hasAudio: audioTracks.length > 0,
  });
}

export function attachMediaStreamTarget({ video, stream, audioEnabled = true } = {}) {
  if (!video || typeof video !== 'object') throw new TypeError('video target is required');
  if (!stream || typeof stream.getTracks !== 'function')
    throw new TypeError('MediaStream-like value is required');
  video.srcObject = stream;
  video.playsInline = true;
  video.muted = !audioEnabled;
  return describeMediaStream(stream);
}

export function setMediaAudioEnabled(video, enabled) {
  if (!video || typeof video !== 'object') throw new TypeError('video target is required');
  video.muted = !Boolean(enabled);
  return !video.muted;
}

export function canUsePictureInPicture(video, documentRef = globalThis.document) {
  return Boolean(
    video &&
    typeof video.requestPictureInPicture === 'function' &&
    documentRef?.pictureInPictureEnabled !== false,
  );
}

export async function togglePictureInPicture(video, documentRef = globalThis.document) {
  if (!canUsePictureInPicture(video, documentRef))
    throw new Error('Picture-in-Picture is unavailable in this browser');
  if (
    documentRef?.pictureInPictureElement === video &&
    typeof documentRef.exitPictureInPicture === 'function'
  ) {
    await documentRef.exitPictureInPicture();
    return false;
  }
  await video.requestPictureInPicture();
  return true;
}

export function observeMediaStream(stream, onChange) {
  if (!stream || typeof stream.getTracks !== 'function')
    throw new TypeError('MediaStream-like value is required');
  if (typeof onChange !== 'function') throw new TypeError('onChange callback is required');
  if (
    typeof stream.addEventListener !== 'function' ||
    typeof stream.removeEventListener !== 'function'
  ) {
    throw new TypeError('MediaStream-like value must support track events');
  }
  const emit = () => onChange(describeMediaStream(stream));
  stream.addEventListener('addtrack', emit);
  stream.addEventListener('removetrack', emit);
  emit();
  return Object.freeze({
    disconnect() {
      stream.removeEventListener('addtrack', emit);
      stream.removeEventListener('removetrack', emit);
    },
  });
}
