function numberOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

export function calculateReconnectDelay(
  attempt,
  { baseDelayMs = 500, maxDelayMs = 15_000, jitter = 0, random = Math.random } = {},
) {
  if (!Number.isInteger(attempt) || attempt < 1)
    throw new RangeError('attempt must be a positive integer');
  const base = Math.max(0, numberOr(baseDelayMs, 500));
  const cap = Math.max(base, numberOr(maxDelayMs, 15_000));
  const spread = Math.max(0, Math.min(1, numberOr(jitter, 0)));
  const raw = Math.min(cap, base * 2 ** (attempt - 1));
  const factor = spread ? 1 - spread + 2 * spread * Math.min(1, Math.max(0, Number(random()))) : 1;
  return Math.round(Math.min(cap, Math.max(0, raw * factor)));
}

export function createReconnectPolicy({
  maxAttempts = 5,
  baseDelayMs = 500,
  maxDelayMs = 15_000,
  jitter = 0.2,
  random = Math.random,
} = {}) {
  const limit = Math.max(1, Math.floor(numberOr(maxAttempts, 5)));
  let attempt = 0;
  return {
    get attempt() {
      return attempt;
    },
    get exhausted() {
      return attempt >= limit;
    },
    get maxAttempts() {
      return limit;
    },
    next() {
      if (attempt >= limit) return Object.freeze({ attempt, delayMs: 0, exhausted: true });
      attempt += 1;
      return Object.freeze({
        attempt,
        delayMs: calculateReconnectDelay(attempt, { baseDelayMs, maxDelayMs, jitter, random }),
        exhausted: false,
      });
    },
    reset() {
      attempt = 0;
    },
    succeeded() {
      attempt = 0;
    },
  };
}
