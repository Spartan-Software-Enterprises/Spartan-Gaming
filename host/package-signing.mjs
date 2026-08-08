import {verifyAdapterSignature} from '../src/frontend/adapters/manifest-registry.mjs';

function required(value, name) { if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`); return value.trim(); }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).filter(key => key !== 'signature').sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function algorithmDetails(name) { if (name === 'ECDSA-P256-SHA256') return {import: {name: 'ECDSA', namedCurve: 'P-256'}, sign: {name: 'ECDSA', hash: 'SHA-256'}}; if (name === 'RSA-PSS-SHA256') return {import: {name: 'RSA-PSS', hash: 'SHA-256'}, sign: {name: 'RSA-PSS', saltLength: 32}}; throw new Error(`unsupported package signature algorithm: ${name}`); }
function base64url(value) { return Buffer.from(value).toString('base64url'); }

export function canonicalizePackageManifest(manifest) { if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new TypeError('package manifest must be an object'); return canonical(manifest); }

export async function signPackageManifest({manifest, privateKey, signer, algorithm = 'ECDSA-P256-SHA256', subtle = globalThis.crypto?.subtle} = {}) {
  const signerId = required(signer, 'signer'); if (!privateKey) throw new TypeError('private key is required'); if (!subtle || typeof subtle.sign !== 'function') throw new Error('WebCrypto signing is unavailable');
  const details = algorithmDetails(algorithm); const data = new TextEncoder().encode(canonicalizePackageManifest(manifest)); const signature = await subtle.sign(details.sign, privateKey, data);
  return Object.freeze({...manifest, signature: Object.freeze({algorithm, signer: signerId, value: base64url(signature)})});
}

export async function verifyPackageManifestSignature({manifest, publicKeyJwk, subtle = globalThis.crypto?.subtle} = {}) {
  if (!manifest?.signature) throw new TypeError('signed package manifest is required');
  return verifyAdapterSignature({data: canonicalizePackageManifest(manifest), signature: manifest.signature, publicKeyJwk, subtle});
}
