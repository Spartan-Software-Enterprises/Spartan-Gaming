export const TRANSIENT_SESSION_KEYS = Object.freeze([
  'spartan-gaming.pending-host-pair.v1',
  'spartan-gaming.pending-launch-handoff.v1',
  'spartan-gaming.launch-intent.v1',
  'spartan-gaming.session-recovery.v1',
]);

export function clearTransientSessionData(
  storage = globalThis.sessionStorage,
  keys = TRANSIENT_SESSION_KEYS,
) {
  if (!storage || typeof storage.removeItem !== 'function') return Object.freeze([]);
  const removed = [];
  for (const key of keys) {
    if (typeof key !== 'string' || !key.trim()) continue;
    storage.removeItem(key);
    removed.push(key);
  }
  return Object.freeze(removed);
}
