const STATES = Object.freeze(['disabled', 'unsupported', 'unavailable', 'active', 'released']);

/** Keep a playing session visible where the browser supports Screen Wake Lock. */
export function createWakeLockController({navigatorRef = globalThis.navigator, documentRef = globalThis.document, enabled = true, onState = () => {}} = {}) {
  let desired = enabled !== false;
  let sentinel = null;
  let state = desired ? 'unsupported' : 'disabled';
  const publish = next => { if (!STATES.includes(next)) return state; state = next; onState(state); return state; };
  const handleRelease = () => { sentinel = null; publish(desired ? 'released' : 'disabled'); };
  const acquire = async () => {
    if (!desired) return publish('disabled') === 'active';
    if (sentinel) return publish('active') === 'active';
    if (typeof navigatorRef?.wakeLock?.request !== 'function') { publish('unsupported'); return false; }
    try { sentinel = await navigatorRef.wakeLock.request('screen'); sentinel.addEventListener?.('release', handleRelease); publish('active'); return true; }
    catch { sentinel = null; publish('unavailable'); return false; }
  };
  const acquireWhenVisible = () => { if (desired && documentRef?.visibilityState !== 'hidden' && !sentinel) void acquire(); };
  const start = async () => { desired = true; return acquire(); };
  const stop = async () => { if (!desired && !sentinel) return true; desired = false; const current = sentinel; sentinel = null; current?.removeEventListener?.('release', handleRelease); try { await current?.release?.(); } catch { /* Browser revocation is already a safe stop. */ } publish('disabled'); return true; };
  documentRef?.addEventListener?.('visibilitychange', acquireWhenVisible);
  return Object.freeze({
    get state() { return state; },
    get active() { return Boolean(sentinel); },
    start,
    stop,
    close() { documentRef?.removeEventListener?.('visibilitychange', acquireWhenVisible); void stop(); return this; },
  });
}

export {STATES as WAKE_LOCK_STATES};
