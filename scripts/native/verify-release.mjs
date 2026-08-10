#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {verifyPackageManifestSignature} from '../../host/package-signing.mjs';

function required(value, name) { if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} is required`); return value.trim(); }

export async function verifyReleaseManifest({manifestPath, publicKeyJwk, subtle = globalThis.crypto?.subtle, fsImpl = {readFile}} = {}) {
  const source = path.resolve(required(manifestPath, 'manifest path')); const key = typeof publicKeyJwk === 'string' ? JSON.parse(publicKeyJwk) : publicKeyJwk;
  if (!key || typeof key !== 'object' || Array.isArray(key)) throw new TypeError('public key JWK must be an object');
  const manifest = JSON.parse(await fsImpl.readFile(source, 'utf8'));
  if (!await verifyPackageManifestSignature({manifest, publicKeyJwk: key, subtle})) throw new Error('release manifest signature verification failed');
  return Object.freeze({kind: 'signed-release-manifest', verification: 'webcrypto', status: 'verified', manifestPath: source, id: manifest.id, version: manifest.version, platform: manifest.platform, signer: manifest.signature.signer});
}

function argument(argv, name) { const index = argv.indexOf(name); return index < 0 ? '' : argv[index + 1]; }
if (path.resolve(process.argv[1] || '') === path.resolve(new URL(import.meta.url).pathname)) {
  try { const argv = process.argv.slice(2); const keyEnv = argument(argv, '--public-key-env') || 'SPARTAN_RELEASE_SIGNING_PUBLIC_KEY_JWK'; const result = await verifyReleaseManifest({manifestPath: argument(argv, '--manifest'), publicKeyJwk: process.env[keyEnv]}); console.log(JSON.stringify(result)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
