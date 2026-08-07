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
