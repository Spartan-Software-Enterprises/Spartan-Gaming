export const LAUNCH_INTENT_KEY = 'spartan-gaming.launch-intent.v1';

function required(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}

function optional(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function optionalBounded(value, name) { const result = optional(value); if (result && result.length > 80) throw new RangeError(`${name} is too long`); return result; }

export function createLaunchIntent({entry, plan, profileId, controllerProfile, returnTo = '../dashboard/index.html', createdAt = new Date().toISOString()} = {}) {
  const backendId = required(entry?.id || plan?.backendId, 'entry.id');
  const backendType = required(entry?.backendType, 'entry.backendType');
  const action = required(plan?.action, 'plan.action');
  const mode = required(plan?.mode || entry?.launchMode || 'default', 'plan.mode');
  const url = optional(plan?.url || entry?.url);
  if (url && !/^https:\/\//i.test(url)) throw new TypeError('launch intent URLs must use HTTPS');
  return Object.freeze({version: 1, backendId, backendType, mode, action, url, profileId: optional(profileId), controllerProfile: optionalBounded(controllerProfile || plan?.controllerProfile, 'controllerProfile'), returnTo: required(returnTo, 'returnTo'), requirements: Object.freeze([...(plan?.requirements || entry?.requirements || [])].map(value => required(value, 'requirement'))), capabilities: Object.freeze([...(plan?.capabilities || entry?.capabilities || [])].map(value => required(value, 'capability'))), createdAt: required(createdAt, 'createdAt')});
}

export function saveLaunchIntent(storage = globalThis.sessionStorage, intent) {
  if (!storage || typeof storage.setItem !== 'function') throw new TypeError('session storage is required');
  const normalized = createLaunchIntent({entry: {id: intent?.backendId, backendType: intent?.backendType}, plan: intent, profileId: intent?.profileId, controllerProfile: intent?.controllerProfile, returnTo: intent?.returnTo, createdAt: intent?.createdAt});
  storage.setItem(LAUNCH_INTENT_KEY, JSON.stringify(normalized));
  return normalized;
}

export function readLaunchIntent(storage = globalThis.sessionStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(LAUNCH_INTENT_KEY) || 'null');
    if (!parsed || parsed.version !== 1) return null;
    return createLaunchIntent({entry: {id: parsed.backendId, backendType: parsed.backendType}, plan: parsed, profileId: parsed.profileId, controllerProfile: parsed.controllerProfile, returnTo: parsed.returnTo, createdAt: parsed.createdAt});
  } catch { return null; }
}

export function clearLaunchIntent(storage = globalThis.sessionStorage) { storage?.removeItem?.(LAUNCH_INTENT_KEY); }

export function consumeLaunchIntent(storage = globalThis.sessionStorage, {backendId, backendType, action, maxAgeMs = 10 * 60 * 1000, now = Date.now()} = {}) {
  const intent = readLaunchIntent(storage);
  if (!intent) return null;
  const created = Date.parse(intent.createdAt);
  const age = Number(now) - created;
  if (!Number.isFinite(created) || !Number.isFinite(age) || age < 0 || age > maxAgeMs) { clearLaunchIntent(storage); return null; }
  if (backendId && intent.backendId !== backendId) return null;
  if (backendType && intent.backendType !== backendType) return null;
  if (action && intent.action !== action) return null;
  clearLaunchIntent(storage);
  return intent;
}
