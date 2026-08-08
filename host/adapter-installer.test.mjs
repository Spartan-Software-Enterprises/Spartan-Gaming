import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {promises as fs} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {createAdapterInstallTransactionPlan, createNativeAdapterInstaller} from './adapter-installer.mjs';

const payload = new TextEncoder().encode('signed-adapter-payload');
const integrity = `sha256-${createHash('sha256').update(payload).digest('base64url')}`;
const request = {version: 1, id: 'dolphin-native', from: '1.0.0', to: '1.1.0', platform: 'linux', installScope: 'user', requiresRestart: true, artifact: {url: 'https://downloads.example.test/dolphin', sizeBytes: payload.byteLength, integrity}, verification: {integrity, signature: {algorithm: 'ECDSA-P256-SHA256', signer: 'release', value: 'sig'}, license: 'GPL-2.0-or-later'}};

test('adapter install plans reject unsafe paths and mismatched verification metadata', () => { assert.throws(() => createAdapterInstallTransactionPlan({request: {...request, id: '../escape'}, installRoot: '/tmp/adapters'}), /unsafe/); assert.throws(() => createAdapterInstallTransactionPlan({request: {...request, verification: {...request.verification, integrity: 'sha256-other'}}, installRoot: '/tmp/adapters'}), /match/); });

test('native adapter installer verifies, stages, publishes, and writes an atomic pointer', async () => { const root = await fs.mkdtemp(join(tmpdir(), 'spartan-adapter-')); try { const installer = createNativeAdapterInstaller({installRoot: root, download: async () => payload, verifySignature: async ({data, signature}) => data.byteLength === payload.byteLength && signature.signer === 'release'}); const result = await installer.install(request); assert.equal(result.status, 'installed'); assert.equal(await fs.readFile(join(root, 'dolphin-native', 'current.json'), 'utf8'), JSON.stringify({id: 'dolphin-native', version: '1.1.0', integrity})); assert.equal((await fs.readFile(join(root, 'dolphin-native', '1.1.0', 'adapter.artifact'))).toString(), 'signed-adapter-payload'); } finally { await fs.rm(root, {recursive: true, force: true}); } });

test('native adapter installer rolls back staging and publication on verification failure', async () => { const root = await fs.mkdtemp(join(tmpdir(), 'spartan-adapter-')); try { const installer = createNativeAdapterInstaller({installRoot: root, download: async () => payload, verifySignature: async () => false}); await assert.rejects(() => installer.install(request), /signature/); await assert.rejects(() => fs.access(join(root, 'dolphin-native', '1.1.0'))); } finally { await fs.rm(root, {recursive: true, force: true}); } });
test('native adapter installer fails closed when no signature verifier is supplied', async () => { const root = await fs.mkdtemp(join(tmpdir(), 'spartan-adapter-')); try { const installer = createNativeAdapterInstaller({installRoot: root, download: async () => payload}); await assert.rejects(() => installer.install(request), /verifier/); } finally { await fs.rm(root, {recursive: true, force: true}); } });
