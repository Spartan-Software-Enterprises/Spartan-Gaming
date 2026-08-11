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

/** Normalize settings that can be applied to the Electron renderer at runtime. */
export function normalizeElectronRuntimePolicy(settings = {}) {
  const updatePolicy = normalizeElectronUpdatePolicy(settings);
  const powerMode = ['Balanced', 'Performance', 'Battery saver'].includes(settings?.powerMode)
    ? settings.powerMode
    : 'Balanced';
  const permissionPrompts = PERMISSION_PROMPT_MODES.includes(settings?.permissionPrompts)
    ? settings.permissionPrompts
    : 'Ask per site';
  return Object.freeze({
    developerMode: settings?.developerMode === true,
    backgroundApps: settings?.backgroundApps === true,
    globalShortcut: normalizeGlobalShortcut(settings?.globalShortcut),
    backgroundThrottling: settings?.backgroundThrottling !== false || powerMode === 'Battery saver',
    powerMode,
    doNotTrack: settings?.doNotTrack === true,
    blockThirdPartyCookies: settings?.blockThirdPartyCookies === true,
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
