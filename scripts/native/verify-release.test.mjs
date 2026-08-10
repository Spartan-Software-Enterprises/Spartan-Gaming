import assert from 'node:assert/strict';
import test from 'node:test';
import {verifyReleaseManifest} from './verify-release.mjs';

const manifest = {id: 'native-linux', version: 'build-1', kind: 'input', platform: 'linux', format: 'directory', files: [{path: 'index.mjs', type: 'file', sizeBytes: 1, integrity: 'sha256-a'}], entrypoint: 'index.mjs', signature: {algorithm: 'ECDSA-P256-SHA256', signer: 'release', value: 'sig'}};

test('release publisher verifies the complete signed manifest through WebCrypto', async () => { const calls = []; const result = await verifyReleaseManifest({manifestPath: '/external/package-manifest.signed.json', publicKeyJwk: {kty: 'EC', crv: 'P-256'}, fsImpl: {async readFile() { return JSON.stringify(manifest); }}, subtle: {async importKey(...args) { calls.push(['importKey', ...args]); return 'key'; }, async verify(...args) { calls.push(['verify', ...args]); return true; }}}); assert.equal(result.status, 'verified'); assert.equal(result.platform, 'linux'); assert.equal(calls[0][0], 'importKey'); assert.equal(calls[1][0], 'verify'); });
test('release publisher fails closed when WebCrypto rejects a manifest', async () => { await assert.rejects(() => verifyReleaseManifest({manifestPath: '/external/package-manifest.signed.json', publicKeyJwk: {kty: 'EC', crv: 'P-256'}, fsImpl: {async readFile() { return JSON.stringify(manifest); }}, subtle: {async importKey() { return 'key'; }, async verify() { return false; }}}), /verification failed/); });
