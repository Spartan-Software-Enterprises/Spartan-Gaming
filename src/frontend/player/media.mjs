function tracks(stream, kind) { return typeof stream?.getTracks === 'function' ? stream.getTracks().filter(track => track?.kind === kind) : []; }

export function describeMediaStream(stream) {
  const videoTracks = tracks(stream, 'video'); const audioTracks = tracks(stream, 'audio');
  return Object.freeze({videoTracks: videoTracks.length, audioTracks: audioTracks.length, hasVideo: videoTracks.length > 0, hasAudio: audioTracks.length > 0});
}

export function attachMediaStreamTarget({video, stream, audioEnabled = true} = {}) {
  if (!video || typeof video !== 'object') throw new TypeError('video target is required');
  if (!stream || typeof stream.getTracks !== 'function') throw new TypeError('MediaStream-like value is required');
  video.srcObject = stream; video.playsInline = true; video.muted = !audioEnabled;
  return describeMediaStream(stream);
}

export function setMediaAudioEnabled(video, enabled) {
  if (!video || typeof video !== 'object') throw new TypeError('video target is required');
  video.muted = !Boolean(enabled);
  return !video.muted;
}

export function canUsePictureInPicture(video, documentRef = globalThis.document) {
  return Boolean(video && typeof video.requestPictureInPicture === 'function' && documentRef?.pictureInPictureEnabled !== false);
}

export async function togglePictureInPicture(video, documentRef = globalThis.document) {
  if (!canUsePictureInPicture(video, documentRef)) throw new Error('Picture-in-Picture is unavailable in this browser');
  if (documentRef?.pictureInPictureElement === video && typeof documentRef.exitPictureInPicture === 'function') {
    await documentRef.exitPictureInPicture();
    return false;
  }
  await video.requestPictureInPicture();
  return true;
}

export function observeMediaStream(stream, onChange) {
  if (!stream || typeof stream.getTracks !== 'function') throw new TypeError('MediaStream-like value is required');
  if (typeof onChange !== 'function') throw new TypeError('onChange callback is required');
  if (typeof stream.addEventListener !== 'function' || typeof stream.removeEventListener !== 'function') {
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
