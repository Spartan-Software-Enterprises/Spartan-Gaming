import {normalizeAdapterPackageManifest} from '../host/adapter-package.mjs';
import {signPackageManifest} from '../host/package-signing.mjs';

const ALGORITHMS = new Set(['ECDSA-P256-SHA256', 'RSA-PSS-SHA256']);

function required(value, name) { if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`); return value.trim(); }
function bounded(value, fallback, minimum, maximum) { const number = Number(value); return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, Math.floor(number))) : fallback; }

/**
 * Release-side signing boundary. Key custody, authorization, and transport are
 * injected so this module never stores secrets or assumes a deployment model.
 */
export function createPackageSigningService({keyProvider, authorize = async () => false, subtle = globalThis.crypto?.subtle, signer, algorithm = 'ECDSA-P256-SHA256', maxRequestsPerWindow = 60, windowMs = 60_000, clock = () => Date.now()} = {}) {
  const signerId = required(signer, 'signer'); if (!ALGORITHMS.has(algorithm)) throw new Error(`unsupported signing algorithm: ${algorithm}`); if (typeof keyProvider !== 'function' || typeof authorize !== 'function') throw new TypeError('keyProvider and authorize must be functions');
  const limit = bounded(maxRequestsPerWindow, 60, 1, 1_000); const duration = bounded(windowMs, 60_000, 1_000, 3_600_000); let windowStart = Number(clock()); let requests = 0; let successful = 0;
  function rateLimit() { const now = Number(clock()); if (!Number.isFinite(now)) throw new TypeError('clock must return a finite number'); if (now - windowStart >= duration) { windowStart = now; requests = 0; } if (requests >= limit) throw new Error('package signing rate limit exceeded'); requests += 1; }
  return Object.freeze({
    async sign({manifest, identity, authorization} = {}) {
      rateLimit(); const principal = required(identity, 'identity'); if (!await authorize({identity: principal, authorization})) throw new Error('package signing authorization denied');
      if (manifest?.signature) throw new Error('package manifest is already signed');
      const custody = await keyProvider({identity: principal, signer: signerId, algorithm}); if (!custody?.privateKey || custody.algorithm !== algorithm || custody.signer !== signerId) throw new Error('key custody provider returned an invalid signing key');
      const unsigned = normalizeAdapterPackageManifest({...manifest, signature: {algorithm, signer: signerId, value: 'pending'}}); const signed = await signPackageManifest({manifest: {...unsigned, signature: undefined}, privateKey: custody.privateKey, signer: signerId, algorithm, subtle});
      successful += 1; return Object.freeze({status: 'signed', manifest: normalizeAdapterPackageManifest(signed), signer: signerId, algorithm});
    },
    health() { return Object.freeze({status: 'ready', signer: signerId, algorithm, requests, successful, windowMs: duration, keyMaterial: 'external'}); },
  });
}
