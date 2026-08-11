import { randomBytes, timingSafeEqual } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6,12}$/;

export function createPairingCode(length = 8) {
  if (!Number.isInteger(length) || length < 6 || length > 12)
    throw new TypeError('pairing code length must be between 6 and 12');
  const bytes = randomBytes(length);
  return [...bytes].map((byte) => ALPHABET[byte % ALPHABET.length]).join('');
}

export function normalizePairingCode(value) {
  const code = String(value || '')
    .toUpperCase()
    .replace(/[\s-]/g, '');
  if (!CODE_PATTERN.test(code))
    throw new TypeError('pairing code must use the safe 6–12 character alphabet');
  return code;
}

function equal(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createPairingAuthority({
  code = createPairingCode(),
  expiresAt = Date.now() + 5 * 60 * 1000,
} = {}) {
  const expected = normalizePairingCode(code);
  let used = false;
  return Object.freeze({
    get expiresAt() {
      return new Date(expiresAt).toISOString();
    },
    get used() {
      return used;
    },
    get expired() {
      return Date.now() >= expiresAt;
    },
    matches(candidate) {
      if (used || Date.now() >= expiresAt) return false;
      let normalized;
      try {
        normalized = normalizePairingCode(candidate);
      } catch {
        return false;
      }
      return equal(normalized, expected);
    },
    verify(candidate) {
      if (!this.matches(candidate)) return false;
      used = true;
      return true;
    },
  });
}
