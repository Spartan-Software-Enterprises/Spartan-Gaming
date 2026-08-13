export const AUTO_LOGIN_KEY = 'spartan-gaming.auto-login.v1';
export const AUTO_LOGIN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const MAX_ENDPOINT_LENGTH = 2048;
const MAX_SESSION_ID_LENGTH = 256;
const MAX_TICKET_LENGTH = 4096;
const MAX_LABEL_LENGTH = 160;

function text(value, maxLength) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim();
  return normalized.length <= maxLength ? normalized : '';
}

function endpoint(value) {
  const normalized = text(value, MAX_ENDPOINT_LENGTH);
  try {
    const parsed = new URL(normalized);
    return ['ws:', 'wss:'].includes(parsed.protocol) ? normalized : '';
  } catch {
    return '';
  }
}

/**
 * Build a bounded, versioned auto-login handoff from the last authenticated
 * host session. The handoff is stored only in the local app profile when the
 * user explicitly enables auto-login; it is never read from another browser.
 */
export function createAutoLoginHandoff(values = {}, now = Date.now()) {
  const createdAt = Number.isFinite(now) ? now : Date.now();
  const expiresAt = Number(values.expiresAt);
  const expiry = Number.isFinite(expiresAt) ? expiresAt : createdAt + AUTO_LOGIN_TTL_MS;
  if (expiry <= createdAt || expiry > createdAt + AUTO_LOGIN_TTL_MS) return null;
  const handoff = {
    version: 1,
    endpoint: endpoint(values.endpoint),
    sessionId: text(values.sessionId, MAX_SESSION_ID_LENGTH),
    ticket: text(values.ticket, MAX_TICKET_LENGTH),
    backendId: text(values.backendId, MAX_LABEL_LENGTH),
    backendType: text(values.backendType, MAX_LABEL_LENGTH),
    backendName: text(values.backendName, MAX_LABEL_LENGTH),
    hostId: text(values.hostId, MAX_LABEL_LENGTH),
    createdAt,
    expiresAt: expiry,
  };
  if (!handoff.endpoint || !handoff.sessionId || !handoff.ticket) return null;
  return Object.freeze(handoff);
}

export function saveAutoLoginHandoff(
  storage = globalThis.localStorage,
  values = {},
  now = Date.now(),
) {
  const handoff = createAutoLoginHandoff(values, now);
  if (!handoff || !storage || typeof storage.setItem !== 'function') return false;
  try {
    storage.setItem(AUTO_LOGIN_KEY, JSON.stringify(handoff));
    return true;
  } catch {
    return false;
  }
}

export function readAutoLoginHandoff(storage = globalThis.localStorage, now = Date.now()) {
  if (!storage || typeof storage.getItem !== 'function') return null;
  try {
    const raw = storage.getItem(AUTO_LOGIN_KEY);
    if (!raw) return null;
    const handoff = createAutoLoginHandoff(JSON.parse(raw), now);
    if (!handoff) {
      storage.removeItem?.(AUTO_LOGIN_KEY);
      return null;
    }
    return handoff;
  } catch {
    return null;
  }
}

export function clearAutoLoginHandoff(storage = globalThis.localStorage) {
  if (!storage || typeof storage.removeItem !== 'function') return false;
  try {
    storage.removeItem(AUTO_LOGIN_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Decide whether an authenticated connection is eligible to be remembered. */
export function shouldRememberAutoLogin({
  enabled = false,
  authenticated = false,
  context = {},
} = {}) {
  if (enabled !== true || authenticated !== true) return false;
  return Boolean(context?.backendId || context?.hostId);
}
