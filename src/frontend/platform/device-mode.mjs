const TV_USER_AGENT =
  /smart-tv|smarttv|hbbtv|tizen|webos|web0s|googletv|android tv|aft\w+|fire tv|roku|netcast/i;
const MOBILE_USER_AGENT = /android|mobile|phone/i;

export const DEVICE_MODES = Object.freeze([
  'desktop',
  'chromeos',
  'handheld',
  'mobile',
  'television',
]);
export const DEVICE_MODE_OPTIONS = Object.freeze([
  'Automatic',
  'Desktop',
  'ChromeOS',
  'Handheld',
  'Mobile',
  'Television',
]);

const MODE_BY_SETTING = Object.freeze({
  Automatic: 'automatic',
  Desktop: 'desktop',
  ChromeOS: 'chromeos',
  Handheld: 'handheld',
  Mobile: 'mobile',
  Television: 'television',
});

function widthOf(viewport = {}) {
  const width = Number(viewport.width);
  return Number.isFinite(width) && width > 0 ? width : 1280;
}

function maxTouchPointsOf(navigatorRef) {
  const value = Number(navigatorRef?.maxTouchPoints);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function detectDeviceMode({
  navigatorRef = globalThis.navigator,
  viewport = {},
  userAgent,
} = {}) {
  const agent = String(userAgent ?? navigatorRef?.userAgent ?? '');
  if (TV_USER_AGENT.test(agent)) return 'television';
  if (/CrOS/i.test(agent)) return 'chromeos';
  const width = widthOf(viewport);
  const touchPoints = maxTouchPointsOf(navigatorRef);
  if (MOBILE_USER_AGENT.test(agent) || (/Macintosh/i.test(agent) && touchPoints > 1))
    return width >= 700 ? 'handheld' : 'mobile';
  if (touchPoints > 0) return width <= 900 ? 'handheld' : 'chromeos';
  return 'desktop';
}

export function resolveDeviceMode({ settings = {}, detectedMode = 'desktop' } = {}) {
  const forced = MODE_BY_SETTING[settings['appearance.deviceMode']];
  if (forced && forced !== 'automatic') return forced;
  return DEVICE_MODES.includes(detectedMode) ? detectedMode : 'desktop';
}

const PROFILES = Object.freeze({
  desktop: {
    navigation: 'pointer-keyboard',
    touchControls: false,
    preferFullscreen: false,
    focusScale: 1,
    columns: 3,
  },
  chromeos: {
    navigation: 'pointer-keyboard',
    touchControls: true,
    preferFullscreen: false,
    focusScale: 1,
    columns: 3,
  },
  handheld: {
    navigation: 'controller-touch',
    touchControls: true,
    preferFullscreen: true,
    focusScale: 1.08,
    columns: 2,
  },
  mobile: {
    navigation: 'touch',
    touchControls: true,
    preferFullscreen: true,
    focusScale: 1.08,
    columns: 1,
  },
  television: {
    navigation: 'remote-controller',
    touchControls: false,
    preferFullscreen: true,
    focusScale: 1.2,
    columns: 4,
  },
});

export function resolvePresentationProfile({
  settings = {},
  detectedMode = 'desktop',
  viewport = {},
} = {}) {
  const mode = resolveDeviceMode({ settings, detectedMode });
  const profile = PROFILES[mode];
  const width = widthOf(viewport);
  const scale = Number(settings['appearance.uiScale']);
  const baseScale = Number.isFinite(scale) ? Math.max(80, Math.min(140, scale)) : 100;
  return Object.freeze({
    mode,
    navigation: profile.navigation,
    touchControls: profile.touchControls,
    preferFullscreen: profile.preferFullscreen,
    focusScale: profile.focusScale,
    columns: profile.columns,
    narrowViewport: width < 720,
    effectiveUiScale: Math.min(160, Math.round(baseScale * profile.focusScale)),
  });
}
