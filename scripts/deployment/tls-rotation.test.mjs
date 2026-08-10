import assert from 'node:assert/strict';
import {createSign, generateKeyPairSync} from 'node:crypto';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {inspectTlsCertificatePair, rotateTlsCertificatePair} from './tls-rotation.mjs';

function length(size) { if (size < 128) return Buffer.from([size]); const bytes = []; let value = size; while (value) { bytes.unshift(value & 255); value >>= 8; } return Buffer.from([0x80 | bytes.length, ...bytes]); }
function der(tag, value) { const body = Buffer.isBuffer(value) ? value : Buffer.from(value); return Buffer.concat([Buffer.from([tag]), length(body.length), body]); }
function integer(value) { let bytes = Buffer.from([value]); while (bytes.length > 1 && bytes[0] === 0) bytes = bytes.subarray(1); if (bytes[0] & 0x80) bytes = Buffer.concat([Buffer.from([0]), bytes]); return der(0x02, bytes); }
function algorithm() { return der(0x30, Buffer.concat([der(0x06, Buffer.from('2a864886f70d01010b', 'hex')), der(0x05, Buffer.alloc(0))])); }
function name() { return der(0x30, der(0x31, der(0x30, Buffer.concat([der(0x06, Buffer.from('550403', 'hex')), der(0x0c, Buffer.from('Spartan TLS test'))])))); }
function utc(date) { return der(0x17, Buffer.from(date.toISOString().slice(2, 19).replace('T', '').replaceAll('-', '').replaceAll(':', '') + 'Z')); }
function certificatePair(now = new Date()) {
  const {privateKey, publicKey} = generateKeyPairSync('rsa', {modulusLength: 2048});
  const from = new Date(now.getTime() - 86400000); const to = new Date(now.getTime() + 30 * 86400000);
  const tbs = der(0x30, Buffer.concat([der(0xa0, integer(2)), integer(7), algorithm(), name(), der(0x30, Buffer.concat([utc(from), utc(to)])), name(), publicKey.export({type: 'spki', format: 'der'})]));
  const signer = createSign('RSA-SHA256'); signer.update(tbs); signer.end();
  const signature = signer.sign(privateKey);
  const cert = der(0x30, Buffer.concat([tbs, algorithm(), der(0x03, Buffer.concat([Buffer.from([0]), signature]))]));
  return {keyPem: privateKey.export({type: 'pkcs8', format: 'pem'}), certPem: cert.toString('base64').match(/.{1,64}/g).join('\n').replace(/^/, '-----BEGIN CERTIFICATE-----\n').concat('\n-----END CERTIFICATE-----\n')};
}

test('TLS certificate inspection validates dates and key matching without exposing key material', () => {
  const now = new Date('2026-08-10T12:00:00.000Z'); const pair = certificatePair(now); const result = inspectTlsCertificatePair({...pair, now});
  assert.equal(result.subject, 'CN=Spartan TLS test'); assert.equal(result.issuer, 'CN=Spartan TLS test'); assert.equal(result.daysRemaining, 30); assert.equal('keyPem' in result, false); const otherKey = generateKeyPairSync('rsa', {modulusLength: 2048}).privateKey.export({type: 'pkcs8', format: 'pem'}); assert.throws(() => inspectTlsCertificatePair({...pair, keyPem: otherKey, now}), /does not match/);
});

test('TLS rotation stages, publishes, and removes old certificate material', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'spartan-tls-')); try {
    const now = new Date('2026-08-10T12:00:00.000Z'); const pair = certificatePair(now); const keyPath = path.join(root, 'server.key'); const certPath = path.join(root, 'server.crt'); await writeFile(keyPath, pair.keyPem, {mode: 0o600}); await writeFile(certPath, pair.certPem);
    const result = await rotateTlsCertificatePair({keyPath, certPath, ...certificatePair(now), now}); assert.equal(result.status, 'rotated'); assert.equal((await readFile(keyPath, 'utf8')).includes('PRIVATE KEY'), true); assert.equal((await readFile(certPath, 'utf8')).includes('CERTIFICATE'), true);
    const files = await (await import('node:fs/promises')).readdir(root); assert.deepEqual(files.sort(), ['server.crt', 'server.key']);
  } finally { await rm(root, {recursive: true, force: true}); }
});
