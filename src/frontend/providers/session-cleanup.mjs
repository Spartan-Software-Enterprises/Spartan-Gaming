export const PROVIDER_SESSION_KEYS = Object.freeze([
  'spartan-gaming.launch-intent.v1',
  'spartan-gaming.session-recovery.v1',
  'spartan-gaming.pending-host-pair.v1',
]);

export const LOCAL_STORAGE_PROVIDER_KEYS = Object.freeze([
  'spartan-gaming.auto-login.v1',
]);

export function clearProviderSessionState(
  storage = globalThis.sessionStorage,
  keys = PROVIDER_SESSION_KEYS,
) {
  if (!storage || typeof storage.removeItem !== 'function')
    return Object.freeze({ removed: Object.freeze([]), officialSignOutRequired: true });
  const removed = [];
  for (const key of keys) {
    if (typeof key !== 'string' || !key.trim()) continue;
    storage.removeItem(key);
    removed.push(key);
  }
  return Object.freeze({ removed: Object.freeze(removed), officialSignOutRequired: true });
}

export function clearAutoLoginStorage(storage = globalThis.localStorage) {
  return clearProviderSessionState(storage, LOCAL_STORAGE_PROVIDER_KEYS);
}
