import assert from 'node:assert/strict';
import test from 'node:test';
import {requestSignedReleaseManifest} from './sign-release.mjs';

const manifest = {id: 'native-linux', version: 'build-1', kind: 'input', platform: 'linux', format: 'directory', files: [{path: 'index.mjs', type: 'file', sizeBytes: 1, integrity: 'sha256-a'}], entrypoint: 'index.mjs'};

test('release signing client authenticates without exposing the token and preserves manifest content', async () => {
  let request;
  const result = await requestSignedReleaseManifest({manifest, serviceUrl: 'https://signing.example.test/v1/sign', token: 'secret-token', fetchImpl: async (url, options) => { request = {url, options}; return {ok: true, async json() { return {manifest: {...manifest, signature: {algorithm: 'ECDSA-P256-SHA256', signer: 'release', value: 'sig'}}}; }}; }});
  assert.equal(result.status, 'signed'); assert.equal(result.manifest.signature.signer, 'release'); assert.equal(request.url, 'https://signing.example.test/v1/sign'); assert.equal(request.options.headers.authorization, 'Bearer secret-token'); assert.match(request.options.body, /native-linux/);
});

test('release signing client rejects insecure endpoints, unsigned input errors, and changed responses', async () => {
  await assert.rejects(() => requestSignedReleaseManifest({manifest, serviceUrl: 'http://signing.example.test', token: 'token', fetchImpl: async () => ({ok: true, json: async () => ({})})}), /HTTPS/);
  await assert.rejects(() => requestSignedReleaseManifest({manifest: {...manifest, signature: {value: 'already'}}, serviceUrl: 'https://signing.example.test', token: 'token', fetchImpl: async () => ({})}), /already contain/);
  await assert.rejects(() => requestSignedReleaseManifest({manifest, serviceUrl: 'https://signing.example.test', token: 'token', fetchImpl: async () => ({ok: true, json: async () => ({manifest: {...manifest, version: 'changed', signature: {algorithm: 'ECDSA-P256-SHA256', signer: 'release', value: 'sig'}}})})}), /changed/);
});
