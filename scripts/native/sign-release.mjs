#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeAdapterPackageManifest } from '../../host/adapter-package.mjs';

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}
function required(value, name) {
  const result = text(value);
  if (!result) throw new TypeError(`${name} is required`);
  return result;
}
function endpoint(value) {
  const result = required(value, 'signing service URL');
  let url;
  try {
    url = new URL(result);
  } catch {
    throw new TypeError('signing service URL must be a valid HTTPS URL');
  }
  if (url.protocol !== 'https:') throw new TypeError('signing service URL must use HTTPS');
  if (url.username || url.password || url.hash)
    throw new TypeError('signing service URL must not contain credentials or a fragment');
  return url.href;
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .filter((key) => key !== 'signature' && key !== 'totalBytes')
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
function validateUnsignedManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest))
    throw new TypeError('unsigned manifest must be an object');
  if (manifest.signature)
    throw new TypeError('unsigned manifest must not already contain a signature');
  if (
    !text(manifest.id) ||
    !text(manifest.version) ||
    !text(manifest.platform) ||
    !text(manifest.format) ||
    !Array.isArray(manifest.files) ||
    !manifest.files.length
  )
    throw new TypeError('unsigned manifest is incomplete');
  return manifest;
}

export async function requestSignedReleaseManifest({
  manifest,
  serviceUrl,
  token,
  fetchImpl = globalThis.fetch,
  timeoutMs = 30_000,
} = {}) {
  const unsigned = validateUnsignedManifest(manifest);
  const url = endpoint(serviceUrl);
  const bearer = required(token, 'signing service token');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch implementation is required');
  const timeout = Number(timeoutMs);
  if (!Number.isInteger(timeout) || timeout < 1_000 || timeout > 120_000)
    throw new RangeError('signing request timeout must be between 1000 and 120000 milliseconds');
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${bearer}` },
    body: JSON.stringify({ manifest: unsigned }),
    signal: AbortSignal.timeout(timeout),
  });
  if (!response?.ok)
    throw new Error(`signing service rejected manifest: HTTP ${response?.status || 'unknown'}`);
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error('signing service returned invalid JSON');
  }
  const signed = normalizeAdapterPackageManifest(body?.manifest);
  if (canonical(signed) !== canonical(unsigned))
    throw new Error('signing service changed the unsigned manifest');
  return Object.freeze({ status: 'signed', manifest: signed });
}

export async function signReleaseManifest({
  manifestPath,
  outputPath,
  serviceUrl,
  token,
  fsImpl = { readFile, writeFile },
  fetchImpl,
} = {}) {
  const source = path.resolve(required(manifestPath, 'manifest path'));
  const destination = path.resolve(required(outputPath, 'signed manifest output path'));
  const manifest = JSON.parse(await fsImpl.readFile(source, 'utf8'));
  const result = await requestSignedReleaseManifest({ manifest, serviceUrl, token, fetchImpl });
  await fsImpl.writeFile(destination, JSON.stringify(result.manifest, null, 2) + '\n', {
    encoding: 'utf8',
    flag: 'wx',
  });
  return Object.freeze({
    status: result.status,
    outputPath: destination,
    id: result.manifest.id,
    version: result.manifest.version,
    signer: result.manifest.signature.signer,
  });
}

function argument(argv, name) {
  const index = argv.indexOf(name);
  return index < 0 ? '' : argv[index + 1];
}
if (path.resolve(process.argv[1] || '') === path.resolve(new URL(import.meta.url).pathname)) {
  try {
    const argv = process.argv.slice(2);
    const tokenEnv = argument(argv, '--token-env') || 'SPARTAN_RELEASE_SIGNING_TOKEN';
    const result = await signReleaseManifest({
      manifestPath: argument(argv, '--manifest'),
      outputPath: argument(argv, '--output'),
      serviceUrl: argument(argv, '--service-url'),
      token: process.env[tokenEnv],
    });
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
