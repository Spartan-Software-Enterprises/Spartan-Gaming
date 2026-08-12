import { normalizeGlobalShortcut } from '../../src/frontend/settings/electron-runtime.mjs';
import { normalizeElectronUpdatePolicy } from './update-service.mjs';

function origin(value) {
  try {
    return new URL(String(value)).origin;
  } catch {
    return '';
  }
}
const PERMISSION_PROMPT_MODES = Object.freeze([
  'Ask every time',
  'Ask per site',
  'Block by default',
]);
const TRACKING_PROTECTION_MODES = Object.freeze(['Standard', 'Strict', 'Disabled']);

/**
 * Dependency-free built-in tracker host list. Spartan Gaming is a private
 * application shell, so the same privacy stance that keeps preferences local
 * also cancels well-known advertising and cross-site analytics requests inside
 * provider, emulator, and player views. Subdomains are matched implicitly.
 * General-purpose domains that also host product functionality are never
 * listed, so sign-in, CDNs, and service assets keep working.
 */
const TRACKER_HOSTS = new Set([
  'doubleclick.net',
  'google-analytics.com',
  'googletagmanager.com',
  'googleadservices.com',
  'googlesyndication.com',
  'adnxs.com',
  'amazon-adsystem.com',
  'adsrvr.org',
  'adroll.com',
  'scorecardresearch.com',
  'quantserve.com',
  'criteo.com',
  'taboola.com',
  'outbrain.com',
  'pubmatic.com',
  'openx.net',
  'mathtag.com',
  'bidswitch.net',
  'rubiconproject.com',
  'casalemedia.com',
  'imrworldwide.com',
  'adsymptotic.com',
  'moatads.com',
  'clarity.ms',
  'hotjar.com',
  'fullstory.com',
  'amplitude.com',
  'segment.io',
  'mixpanel.com',
  'heap.io',
  'crazyegg.com',
  'chartbeat.com',
  'mouseflow.com',
  'optimizely.com',
  'clicky.com',
  'connect.facebook.net',
  'pixel.facebook.com',
  'static.ads-twitter.com',
  'analytics.twitter.com',
  'bat.bing.com',
  'partner.ads.linkedin.com',
  'ads.linkedin.com',
]);

function isTrackerHost(host) {
  if (!host) return false;
  for (const tracker of TRACKER_HOSTS) {
    if (host === tracker || host.endsWith(`.${tracker}`)) return true;
  }
  return false;
}

/** Return true when the request targets a known tracker from another origin. */
export function shouldBlockTrackingRequest(
  { url, initiator } = {},
  policy = normalizeElectronRuntimePolicy(),
) {
  const mode = TRACKING_PROTECTION_MODES.includes(policy?.trackingProtection)
    ? policy.trackingProtection
    : 'Strict';
  if (mode === 'Disabled') return false;
  if (!isThirdPartyRequest({ url, initiator })) return false;
  let host = '';
  try {
    host = new URL(String(url)).hostname.toLowerCase();
  } catch {
    return false;
  }
  return isTrackerHost(host);
}

/** Normalize settings that can be applied to the Electron renderer at runtime. */
export function normalizeElectronRuntimePolicy(settings = {}) {
  const updatePolicy = normalizeElectronUpdatePolicy(settings);
  const powerMode = ['Balanced', 'Performance', 'Battery saver'].includes(settings?.powerMode)
    ? settings.powerMode
    : 'Balanced';
  const permissionPrompts = PERMISSION_PROMPT_MODES.includes(settings?.permissionPrompts)
    ? settings.permissionPrompts
    : 'Ask per site';
  const trackingProtection = TRACKING_PROTECTION_MODES.includes(settings?.trackingProtection)
    ? settings.trackingProtection
    : 'Strict';
  return Object.freeze({
    developerMode: settings?.developerMode === true,
    backgroundApps: settings?.backgroundApps === true,
    globalShortcut: normalizeGlobalShortcut(settings?.globalShortcut),
    backgroundThrottling: settings?.backgroundThrottling !== false || powerMode === 'Battery saver',
    powerMode,
    doNotTrack: settings?.doNotTrack === true,
    blockThirdPartyCookies: settings?.blockThirdPartyCookies === true,
    trackingProtection,
    permissionPrompts,
    updateChannel: updatePolicy.channelLabel,
    autoUpdate: updatePolicy.autoUpdate,
    notifyRestart: updatePolicy.notifyRestart,
  });
}

export function shouldQuitWhenWindowsClose({
  platform = process.platform,
  backgroundApps = false,
} = {}) {
  return platform !== 'darwin' && backgroundApps !== true;
}

/** Return a stored permission decision, or null when the UI must ask the user. */
export function resolvePermissionDecision(
  policy = normalizeElectronRuntimePolicy(),
  { storedDecision } = {},
) {
  if (policy.permissionPrompts === 'Block by default') return false;
  if (policy.permissionPrompts === 'Ask per site' && typeof storedDecision === 'boolean')
    return storedDecision;
  return null;
}

export function isThirdPartyRequest({ url, initiator } = {}) {
  const requestOrigin = origin(url);
  const initiatorOrigin = origin(initiator);
  return Boolean(requestOrigin && initiatorOrigin && requestOrigin !== initiatorOrigin);
}

/** Apply privacy headers without changing credentials, destinations, or methods. */
export function applyElectronPrivacyHeaders(
  headers = {},
  details = {},
  policy = normalizeElectronRuntimePolicy(),
) {
  const next = { ...headers };
  if (policy.doNotTrack) {
    for (const key of Object.keys(next)) if (key.toLowerCase() === 'dnt') delete next[key];
    next.DNT = '1';
  }
  if (policy.blockThirdPartyCookies && isThirdPartyRequest(details)) {
    for (const key of Object.keys(next)) if (key.toLowerCase() === 'cookie') delete next[key];
  }
  return Object.freeze(next);
}
