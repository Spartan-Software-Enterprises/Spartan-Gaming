import {createReconnectPolicy} from './recovery.mjs';

const ACTIVE_STATES = new Set(['attempting', 'waiting']);
function snapshot(state, detail = {}) { return Object.freeze({state, ...detail}); }

export function createReconnectController({attempt, policy = createReconnectPolicy(), setTimeoutFn = globalThis.setTimeout, clearTimeoutFn = globalThis.clearTimeout} = {}) {
  if (typeof attempt !== 'function') throw new TypeError('attempt must be a function');
  if (!policy || typeof policy.next !== 'function' || typeof policy.reset !== 'function') throw new TypeError('policy must provide next() and reset()');
  if (typeof setTimeoutFn !== 'function' || typeof clearTimeoutFn !== 'function') throw new TypeError('timer functions are required');
  const listeners = new Set(); let current = snapshot('idle', {attempt: 0, maxAttempts: policy.maxAttempts}); let timer = null;
  const emit = next => { current = next; listeners.forEach(listener => listener(current)); return current; };
  const clearTimer = () => { if (timer !== null) { clearTimeoutFn(timer); timer = null; } };
  const schedule = plan => { clearTimer(); timer = setTimeoutFn(() => { timer = null; run(plan); }, plan.delayMs); };
  const fail = error => {
    if (!ACTIVE_STATES.has(current.state)) return current;
    const plan = policy.next();
    if (plan.exhausted) return emit(snapshot('exhausted', {attempt: plan.attempt, maxAttempts: policy.maxAttempts, error: String(error?.message || error || 'Reconnect failed')}));
    const next = emit(snapshot('waiting', {attempt: plan.attempt, maxAttempts: policy.maxAttempts, delayMs: plan.delayMs, error: String(error?.message || error || 'Reconnect failed')})); schedule(next); return next;
  };
  const run = (scheduledPlan = null) => {
    if (current.state === 'cancelled' || current.state === 'succeeded' || current.state === 'exhausted') return current;
    const plan = scheduledPlan || policy.next();
    if (plan.exhausted) return emit(snapshot('exhausted', {attempt: plan.attempt, maxAttempts: policy.maxAttempts, error: 'Reconnect attempts exhausted'}));
    emit(snapshot('attempting', {attempt: plan.attempt, maxAttempts: policy.maxAttempts, delayMs: plan.delayMs}));
    try { const result = attempt({attempt: plan.attempt, delayMs: plan.delayMs}); return emit(snapshot('waiting', {attempt: plan.attempt, maxAttempts: policy.maxAttempts, delayMs: plan.delayMs, result})); }
    catch (error) { return fail(error); }
  };
  return Object.freeze({
    get state() { return current; },
    on(listener) { if (typeof listener !== 'function') throw new TypeError('listener must be a function'); listeners.add(listener); return () => listeners.delete(listener); },
    start() { if (ACTIVE_STATES.has(current.state)) return current; clearTimer(); policy.reset(); current = snapshot('idle', {attempt: 0, maxAttempts: policy.maxAttempts}); return run(); },
    fail,
    succeed(result = undefined) { clearTimer(); policy.reset(); return emit(snapshot('succeeded', {attempt: current.attempt, maxAttempts: policy.maxAttempts, result})); },
    cancel() { clearTimer(); return emit(snapshot('cancelled', {attempt: current.attempt, maxAttempts: policy.maxAttempts})); },
    reset() { clearTimer(); policy.reset(); return emit(snapshot('idle', {attempt: 0, maxAttempts: policy.maxAttempts})); },
  });
}
