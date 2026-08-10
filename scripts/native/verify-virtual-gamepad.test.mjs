import assert from 'node:assert/strict';
import test from 'node:test';
import {verifyInstalledVirtualGamepad} from './verify-virtual-gamepad.mjs';

const key = {kty: 'EC', crv: 'P-256', x: 'test', y: 'test'};

test('virtual-gamepad verifier loads only a verified platform-matched package and never executes input', async () => {
    let closed = 0; const report = await verifyInstalledVirtualGamepad({platform: 'windows', installRoot: '/opt/spartan/adapters', id: 'windows-driver', publicKeyJwk: key, verifyManifest: async () => true, loadModule: async specifier => { assert.match(specifier, /adapter.mjs$/); return {createVirtualGamepad: async options => { assert.equal(options.platform, 'win32'); return {platform: 'win32', kind: 'virtual-gamepad', execute() { throw new Error('must not execute'); }, close() { closed += 1; }}; }}; }, fsImpl: {readFile: async (file, encoding) => { assert.equal(encoding, 'utf8'); if (file.endsWith('current.json')) return JSON.stringify({id: 'windows-driver', version: '1.0.0'}); if (file.endsWith('manifest.json')) return JSON.stringify({id: 'windows-driver', version: '1.0.0', kind: 'virtual-gamepad', platform: 'win32', format: 'directory', entrypoint: 'adapter.mjs', files: [{path: 'adapter.mjs', type: 'file', sizeBytes: 1, integrity: 'sha256-file'}], signature: {algorithm: 'ECDSA', value: 'signed', signer: 'test'}}); throw new Error(`unexpected file ${file}`); }}});
  assert.equal(report.status, 'ready'); assert.equal(report.platform, 'win32'); assert.equal(report.kind, 'virtual-gamepad'); assert.equal(report.capabilities.execute, true); assert.equal(closed, 1);
});

test('virtual-gamepad verifier can explicitly exercise a verified adapter', async () => {
  const operations = []; const report = await verifyInstalledVirtualGamepad({platform: 'windows', installRoot: '/opt/spartan/adapters', id: 'windows-driver', publicKeyJwk: key, execute: true, verifyManifest: async () => true, loadModule: async () => ({createVirtualGamepad: async () => ({platform: 'win32', kind: 'virtual-gamepad', execute(operation) { operations.push(operation); }, close() {}})}), fsImpl: {readFile: async file => file.endsWith('current.json') ? JSON.stringify({id: 'windows-driver', version: '1.0.0'}) : JSON.stringify({id: 'windows-driver', version: '1.0.0', kind: 'virtual-gamepad', platform: 'win32', format: 'directory', entrypoint: 'adapter.mjs', files: [{path: 'adapter.mjs', type: 'file', sizeBytes: 1, integrity: 'sha256-file'}], signature: {algorithm: 'ECDSA', value: 'signed', signer: 'test'}})}});
  assert.equal(report.status, 'ready'); assert.deepEqual(report.exercise, {state: 'verified', operations: 3}); assert.deepEqual(operations, [{kind: 'button', control: 'button-0', pressed: true}, {kind: 'button', control: 'button-0', pressed: false}, {kind: 'axis', control: 'axis-0', value: 0}]);
});

test('virtual-gamepad verifier fails closed for a rejected signature or malformed package', async () => {
  const report = await verifyInstalledVirtualGamepad({platform: 'macos', installRoot: '/opt/spartan/adapters', id: 'mac-driver', publicKeyJwk: key, verifyManifest: async () => false, fsImpl: {readFile: async file => file.endsWith('current.json') ? JSON.stringify({id: 'mac-driver', version: '1.0.0'}) : JSON.stringify({id: 'mac-driver', version: '1.0.0', kind: 'virtual-gamepad', platform: 'darwin', format: 'directory', entrypoint: 'adapter.mjs', files: [{path: 'adapter.mjs', type: 'file', sizeBytes: 1, integrity: 'sha256-file'}], signature: {algorithm: 'ECDSA', value: 'unsigned', signer: 'test'}})}});
  assert.equal(report.status, 'unavailable'); assert.match(report.reason, /verification failed/);
});

test('virtual-gamepad verifier normalizes supported platform aliases and rejects unsupported targets', async () => {
  await assert.rejects(() => verifyInstalledVirtualGamepad({platform: 'android', installRoot: '/tmp/adapters', id: 'driver', publicKeyJwk: key}), /unsupported virtual-gamepad platform/);
});
