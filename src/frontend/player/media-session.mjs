function safeHandler(mediaSession, action, handler) {
  try {
    mediaSession.setActionHandler(action, handler);
    return true;
  } catch {
    return false;
  }
}

function boundedSeek(video, offset) {
  if (!video || !Number.isFinite(video.currentTime)) return;
  const duration =
    Number.isFinite(video.duration) && video.duration > 0
      ? video.duration
      : Number.POSITIVE_INFINITY;
  video.currentTime = Math.max(0, Math.min(duration, video.currentTime + offset));
}

export function canUseMediaSession(navigatorRef = globalThis.navigator) {
  return Boolean(
    navigatorRef?.mediaSession && typeof navigatorRef.mediaSession.setActionHandler === 'function',
  );
}

export function createMediaSessionController({
  navigatorRef = globalThis.navigator,
  video,
  metadataFactory = globalThis.MediaMetadata,
  seekOffset = 10,
} = {}) {
  const mediaSession = navigatorRef?.mediaSession;
  if (!canUseMediaSession(navigatorRef))
    return Object.freeze({ supported: false, update() {}, setPlaybackState() {}, dispose() {} });
  const offset = Number.isFinite(Number(seekOffset))
    ? Math.max(1, Math.min(60, Number(seekOffset)))
    : 10;
  const listeners = [];
  const setPlaybackState = (state) => {
    try {
      mediaSession.playbackState = ['none', 'paused', 'playing'].includes(state) ? state : 'none';
    } catch {
      /* Media Session is optional and browser-controlled. */
    }
  };
  const play = () => Promise.resolve(video?.play?.()).catch(() => {});
  const pause = () => {
    try {
      video?.pause?.();
    } catch {
      /* media may have ended during teardown */
    }
  };
  safeHandler(mediaSession, 'play', play);
  safeHandler(mediaSession, 'pause', pause);
  safeHandler(mediaSession, 'stop', () => {
    pause();
    if (video && Number.isFinite(video.currentTime)) video.currentTime = 0;
  });
  safeHandler(mediaSession, 'seekbackward', (details) =>
    boundedSeek(video, -(Number(details?.seekOffset) || offset)),
  );
  safeHandler(mediaSession, 'seekforward', (details) =>
    boundedSeek(video, Number(details?.seekOffset) || offset),
  );
  const onPlay = () => setPlaybackState('playing');
  const onPause = () => setPlaybackState('paused');
  video?.addEventListener?.('play', onPlay);
  video?.addEventListener?.('pause', onPause);
  listeners.push(
    () => video?.removeEventListener?.('play', onPlay),
    () => video?.removeEventListener?.('pause', onPause),
  );
  return Object.freeze({
    supported: true,
    update({ title = 'Spartan Gaming', artist = 'Spartan Gaming', album = 'Game session' } = {}) {
      if (typeof metadataFactory === 'function') {
        try {
          mediaSession.metadata = new metadataFactory({
            title: String(title),
            artist: String(artist),
            album: String(album),
          });
        } catch {
          /* metadata is optional */
        }
      }
    },
    setPlaybackState,
    dispose() {
      listeners.splice(0).forEach((remove) => remove());
      setPlaybackState('none');
    },
  });
}
