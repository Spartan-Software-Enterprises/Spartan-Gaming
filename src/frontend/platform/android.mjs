const ANDROID_FORM_FACTORS = Object.freeze(['phone', 'tablet', 'foldable', 'unknown']);
const ORIENTATIONS = Object.freeze(['Automatic', 'Landscape', 'Portrait']);
const GAME_MODES = Object.freeze(['Follow system', 'Performance', 'Battery', 'Standard']);

function positive(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function widthDp(viewport = {}, density = 1) {
  return positive(viewport.width, 0) / Math.max(0.5, positive(density, 1));
}

/**
 * Classify an Android window from its current bounds, not from a device name.
 * Window segments are supplied by a native shell when a hinge or fold is known.
 */
export function detectAndroidFormFactor({ viewport = {}, density = 1, windowSegments = [] } = {}) {
  if (Array.isArray(windowSegments) && windowSegments.length > 1) return 'foldable';
  const width = widthDp(viewport, density);
  if (width >= 600) return 'tablet';
  if (width > 0) return 'phone';
  return 'unknown';
}

export function resolveAndroidPolicy({
  settings = {},
  formFactor = 'unknown',
  orientation = 'unknown',
} = {}) {
  const factor = ANDROID_FORM_FACTORS.includes(formFactor) ? formFactor : 'unknown';
  const requestedOrientation = ORIENTATIONS.includes(settings['mobile.orientation'])
    ? settings['mobile.orientation']
    : 'Automatic';
  const powerMode = GAME_MODES.includes(settings['mobile.gameMode'])
    ? settings['mobile.gameMode']
    : 'Follow system';
  const normalizedOrientation =
    requestedOrientation === 'Automatic' ? 'sensor' : requestedOrientation.toLowerCase();
  const currentOrientation =
    orientation === 'portrait' || orientation === 'landscape' ? orientation : 'unknown';
  return Object.freeze({
    formFactor: factor,
    orientation: normalizedOrientation,
    currentOrientation,
    keepScreenAwake: settings['mobile.keepScreenAwake'] !== false,
    pictureInPicture: settings['mobile.pictureInPicture'] !== false,
    edgeToEdge: settings['mobile.edgeToEdge'] !== false,
    dataSaver: settings['mobile.dataSaver'] === true,
    gameMode: powerMode,
    touchLayout:
      factor === 'tablet' && settings['accessibility.touchLayout'] === 'Minimal'
        ? 'full'
        : String(settings['accessibility.touchLayout'] || 'Automatic').toLowerCase(),
  });
}

/** Describe the native GameManager query boundary; the app cannot change system Game Mode. */
export function resolveAndroidGameModeIntent({
  apiLevel = 0,
  requestedMode = 'Follow system',
  observedMode = 'Unsupported',
} = {}) {
  const requested = GAME_MODES.includes(requestedMode) ? requestedMode : 'Follow system';
  const observed = GAME_MODES.includes(observedMode) ? observedMode : 'Unsupported';
  const numericApi = Number(apiLevel);
  const supported = Number.isFinite(numericApi) && numericApi >= 31 && observed !== 'Unsupported';
  return Object.freeze({
    apiLevel: Number.isFinite(numericApi) ? Math.max(0, Math.floor(numericApi)) : 0,
    requestedMode: requested,
    observedMode: observed,
    supported,
    queryOnResume: true,
    appCanChangeMode: false,
    accepted: requested === 'Follow system' || (supported && requested === observed),
  });
}

export { ANDROID_FORM_FACTORS, GAME_MODES, ORIENTATIONS };
