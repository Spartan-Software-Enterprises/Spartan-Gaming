import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import test from 'node:test';
import {createReleaseFeedPlanner, createReleaseInstallRequest, normalizeReleaseFeed, verifyReleaseFeed} from './release-feed.mjs';
import {signPackageManifest} from './package-signing.mjs';

const record = {id: 'dolphin', version: '1.0.0', kind: 'emulator', status: 'available', trust: 'signed', platforms: ['linux', 'win32'], capabilities: ['video', 'audio'], license: 'GPL-2.0-or-later', integrity: 'sha256-artifactDigest', signature: {algorithm: 'ECDSA-P256-SHA256', signer: 'spartan-release', value: 'adapter-signature'}, artifact: {url: 'https://releases.example.test/dolphin-1.0.0-linux.tar', sizeBytes: 4096, integrity: 'sha256-artifactDigest'}, package: {id: 'dolphin', version: '1.0.0', kind: 'emulator', platform: 'linux', format: 'tar', entrypoint: 'bin/dolphin', files: [{path: 'bin', type: 'directory', sizeBytes: 0}, {path: 'bin/dolphin', type: 'file', sizeBytes: 2048, integrity: 'sha256-entryDigest'}], signature: {algorithm: 'ECDSA-P256-SHA256', signer: 'spartan-release', value: 'package-signature'}}};

async function signedFeed(records) {
  const unsigned = normalizeReleaseFeed({schemaVersion: 1, updatedAt: '2026-08-09', signer: 'spartan-release', records});
  const {privateKey, publicKey} = generateKeyPairSync('ec', {namedCurve: 'P-256'});
  const privateJwk = privateKey.export({format: 'jwk'});
  const signKey = await globalThis.crypto.subtle.importKey('jwk', privateJwk, {name: 'ECDSA', namedCurve: 'P-256'}, false, ['sign']);
  const signed = await signPackageManifest({manifest: unsigned, privateKey: signKey, signer: 'spartan-release'});
  return {feed: normalizeReleaseFeed(signed), publicKeyJwk: publicKey.export({format: 'jwk'})};
}

test('release feeds normalize and verify a signed canonical payload', async () => { const {feed, publicKeyJwk} = await signedFeed([record]); assert.equal(feed.schemaVersion, 1); assert.equal(feed.records[0].package.entrypoint, 'bin/dolphin'); assert.equal(await verifyReleaseFeed({feed, publicKeyJwk}), true); assert.equal(await verifyReleaseFeed({feed: {...feed, updatedAt: 'tampered'}, publicKeyJwk}), false); });
test('release feed planner creates install, update, and up-to-date plans', async () => { const {feed} = await signedFeed([record]); const fresh = createReleaseFeedPlanner({feed, platform: 'linux', kind: 'emulator'}); assert.equal(fresh.plans[0].status, 'install-available');   const older = createReleaseFeedPlanner({feed, platform: 'linux', installed: [{...record, version: '0.9.0', package: {...record.package, version: '0.9.0'}}]}); assert.equal(older.plans[0].status, 'update-available'); assert.equal(older.plans[0].to, '1.0.0'); const current = createReleaseFeedPlanner({feed, platform: 'linux', installed: [record]}); assert.equal(current.plans[0].status, 'up-to-date'); });
test('release install requests carry artifact and signed package through consent', async () => { const {feed} = await signedFeed([record]); const plan = createReleaseFeedPlanner({feed, platform: 'linux', kind: 'emulator'}).plans[0]; assert.throws(() => createReleaseInstallRequest({plan, platform: 'linux'}), /consent/); const request = createReleaseInstallRequest({plan, platform: 'linux', consent: true}); assert.equal(request.package.entrypoint, 'bin/dolphin'); assert.equal(request.artifact.integrity, 'sha256-artifactDigest'); });
