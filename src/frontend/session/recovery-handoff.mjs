export const SESSION_RECOVERY_KEY = 'spartan-gaming.session-recovery.v1';
export const SESSION_RECOVERY_TTL_MS = 10 * 60 * 1000;

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

export function createSessionRecoveryHandoff(values = {}, now = Date.now()) {
  const expiresAt = Number(values.expiresAt);
  const createdAt = Number.isFinite(now) ? now : Date.now();
  const expiry = Number.isFinite(expiresAt) ? expiresAt : createdAt + SESSION_RECOVERY_TTL_MS;
  if (expiry <= createdAt || expiry > createdAt + SESSION_RECOVERY_TTL_MS) return null;
  const handoff = {
    version: 1,
    endpoint: endpoint(values.endpoint),
    sessionId: text(values.sessionId, MAX_SESSION_ID_LENGTH),
    ticket: text(values.ticket, MAX_TICKET_LENGTH),
    backendId: text(values.backendId, MAX_LABEL_LENGTH),
    backendType: text(values.backendType, MAX_LABEL_LENGTH),
    backendName: text(values.backendName, MAX_LABEL_LENGTH),
    hostId: text(values.hostId, MAX_LABEL_LENGTH),
    expiresAt: expiry,
  };
  if (!handoff.endpoint || !handoff.sessionId || !handoff.ticket) return null;
  return Object.freeze(handoff);
}

export function saveSessionRecoveryHandoff(
  storage = globalThis.sessionStorage,
  values = {},
  now = Date.now(),
) {
  const handoff = createSessionRecoveryHandoff(values, now);
  if (!handoff || !storage || typeof storage.setItem !== 'function') return false;
  try {
    storage.setItem(SESSION_RECOVERY_KEY, JSON.stringify(handoff));
    return true;
  } catch {
    return false;
  }
}

export function readSessionRecoveryHandoff(storage = globalThis.sessionStorage, now = Date.now()) {
  if (!storage || typeof storage.getItem !== 'function') return null;
  try {
    const raw = storage.getItem(SESSION_RECOVERY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const handoff = createSessionRecoveryHandoff(parsed, now);
    if (!handoff) {
      storage.removeItem?.(SESSION_RECOVERY_KEY);
      return null;
    }
    return handoff;
  } catch {
    return null;
  }
}

export function clearSessionRecoveryHandoff(storage = globalThis.sessionStorage) {
  if (!storage || typeof storage.removeItem !== 'function') return false;
  try {
    storage.removeItem(SESSION_RECOVERY_KEY);
    return true;
  } catch {
    return false;
  }
}
