const RESOLUTION_LIMITS = Object.freeze({
  '720p': [1280, 720],
  '1080p': [1920, 1080],
  '1440p': [2560, 1440],
  '4K': [3840, 2160],
  Source: [3840, 2160],
});
const CODEC_ORDER = Object.freeze({
  Automatic: ['av1', 'vp9', 'h264'],
  AV1: ['av1', 'vp9', 'h264'],
  VP9: ['vp9', 'h264'],
  'H.264': ['h264'],
});

function finite(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function boundedRefresh(value) {
  const number = finite(value);
  return number && number > 0 ? Math.min(240, Math.max(1, Math.floor(number))) : null;
}

function displayPreference(value) {
  if (value === 'Ask each time') return 'ask';
  const match = String(value || '').match(/^Display (\d+)$/);
  return match ? { kind: 'index', index: Math.max(0, Number(match[1]) - 1) } : 'automatic';
}

function availableCodecs(preference, capabilities) {
  const requested = CODEC_ORDER[preference] || CODEC_ORDER.Automatic;
  const supported = capabilities?.media?.codecs;
  if (!supported || typeof supported !== 'object') return requested;
  const filtered = requested.filter((codec) => supported[codec] === true);
  return filtered.length ? filtered : requested;
}

export function resolveDisplayPolicy({ settings = {}, capabilities } = {}) {
  const resolution =
    RESOLUTION_LIMITS[settings['streaming.resolution']] || RESOLUTION_LIMITS['1080p'];
  const requestedRefresh = boundedRefresh(
    settings['media.refreshRate'] === 'Automatic'
      ? null
      : String(settings['media.refreshRate']).replace(/\s*Hz$/i, ''),
  );
  const observedRefresh = boundedRefresh(capabilities?.display?.maxRefreshRate);
  const maxRefreshRate = observedRefresh
    ? Math.min(requestedRefresh || observedRefresh, observedRefresh)
    : requestedRefresh;
  const hdrRequested = settings['media.hdr'] === true;
  const hdrAvailable = capabilities?.graphics?.hdr;
  const hdr = hdrRequested && (hdrAvailable === undefined ? true : hdrAvailable === true);
  const display = displayPreference(settings['media.display']);
  const count = Math.max(0, Math.floor(finite(capabilities?.display?.count, 0) || 0));
  const warnings = [];
  if (hdrRequested && hdrAvailable === false)
    warnings.push(
      'HDR is enabled in settings but unavailable in this browser/display configuration.',
    );
  if (requestedRefresh && observedRefresh && requestedRefresh > observedRefresh)
    warnings.push(`Refresh rate capped at the observed ${observedRefresh} Hz browser ceiling.`);
  if (display.kind === 'index' && count > 0 && display.index >= count)
    warnings.push(
      'Selected display is not currently available; the browser will use its default display.',
    );
  return Object.freeze({
    display,
    displayCount: count,
    extendedDisplay: capabilities?.display?.extended === true,
    resolution: Object.freeze({ width: resolution[0], height: resolution[1] }),
    requestedRefreshRate: requestedRefresh,
    observedRefreshRate: observedRefresh,
    maxRefreshRate,
    hdrRequested,
    hdrAvailable: hdrAvailable === undefined ? null : hdrAvailable === true,
    hdr,
    codecs: Object.freeze(availableCodecs(settings['streaming.codec'], capabilities)),
    warnings: Object.freeze(warnings),
  });
}
