import { normalizeHostLaunchRequest } from '../../../host/launch-request.mjs';

export const PENDING_LAUNCH_HANDOFF_KEY = 'spartan-gaming.pending-launch-handoff.v1';
export const LAUNCH_HANDOFF_VERSION = 1;
const MAX_AGE_MS = 10 * 60 * 1000;

function requiredString(value, name) {
  if (typeof value !== 'string' || !value.trim())
    throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}

function normalizeHandoff(value, { now = Date.now() } = {}) {
  if (!value || value.version !== LAUNCH_HANDOFF_VERSION)
    throw new TypeError('launch handoff version is unsupported');
  const request = normalizeHostLaunchRequest(value.request);
  const createdAt = Date.parse(value.createdAt);
  if (!Number.isFinite(createdAt) || createdAt > now || now - createdAt > MAX_AGE_MS)
    throw new Error('launch handoff has expired');
  return Object.freeze({
    version: LAUNCH_HANDOFF_VERSION,
    backendId: requiredString(value.backendId, 'backendId'),
    name: requiredString(value.name, 'name'),
    createdAt: new Date(createdAt).toISOString(),
    request,
  });
}

export function savePendingLaunchHandoff(
  storage = globalThis.sessionStorage,
  { request, backendId, name, now = Date.now() } = {},
) {
  if (!storage || typeof storage.setItem !== 'function')
    throw new TypeError('session storage is required');
  const handoff = normalizeHandoff(
    {
      version: LAUNCH_HANDOFF_VERSION,
      request,
      backendId,
      name,
      createdAt: new Date(now).toISOString(),
    },
    { now },
  );
  storage.setItem(PENDING_LAUNCH_HANDOFF_KEY, JSON.stringify(handoff));
  return handoff;
}

export function readPendingLaunchHandoff(
  storage = globalThis.sessionStorage,
  { now = Date.now() } = {},
) {
  try {
    const raw = storage?.getItem(PENDING_LAUNCH_HANDOFF_KEY);
    if (!raw) return null;
    return normalizeHandoff(JSON.parse(raw), { now });
  } catch {
    return null;
  }
}

export function clearPendingLaunchHandoff(storage = globalThis.sessionStorage) {
  storage?.removeItem?.(PENDING_LAUNCH_HANDOFF_KEY);
}
