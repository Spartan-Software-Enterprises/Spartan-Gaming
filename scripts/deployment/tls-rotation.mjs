#!/usr/bin/env node
import { createPrivateKey, createPublicKey, X509Certificate } from 'node:crypto';
import { readFile, rename, writeFile, chmod, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}
function required(value, name) {
  const result = text(value);
  if (!result) throw new TypeError(`${name} is required`);
  return result;
}
function absolute(value, name) {
  const result = path.resolve(required(value, name));
  if (result === path.dirname(result)) throw new TypeError(`${name} must identify a file`);
  return result;
}
function sameBytes(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
function publicKeyDer(key) {
  return createPublicKey(key).export({ type: 'spki', format: 'der' });
}

export function inspectTlsCertificatePair({ keyPem, certPem, now = new Date() } = {}) {
  const key = createPrivateKey(required(keyPem, 'TLS private key'));
  const certificate = new X509Certificate(required(certPem, 'TLS certificate'));
  const validFrom = new Date(certificate.validFrom);
  const validTo = new Date(certificate.validTo);
  if (!Number.isFinite(validFrom.getTime()) || !Number.isFinite(validTo.getTime()))
    throw new TypeError('TLS certificate validity dates are invalid');
  if (now < validFrom) throw new Error('TLS certificate is not valid yet');
  if (now >= validTo) throw new Error('TLS certificate is expired');
  if (!sameBytes(publicKeyDer(key), certificate.publicKey.export({ type: 'spki', format: 'der' })))
    throw new Error('TLS private key does not match the certificate');
  return Object.freeze({
    subject: certificate.subject,
    issuer: certificate.issuer,
    validFrom: validFrom.toISOString(),
    validTo: validTo.toISOString(),
    daysRemaining: Math.max(0, Math.floor((validTo.getTime() - now.getTime()) / 86400000)),
  });
}

export async function rotateTlsCertificatePair({
  keyPath,
  certPath,
  keyPem,
  certPem,
  now = new Date(),
  fsImpl = { readFile, rename, writeFile, chmod, unlink },
} = {}) {
  const targetKey = absolute(keyPath, 'TLS key path');
  const targetCert = absolute(certPath, 'TLS certificate path');
  if (targetKey === targetCert) throw new Error('TLS key and certificate paths must differ');
  const inspection = inspectTlsCertificatePair({ keyPem, certPem, now });
  const token = `${process.pid}-${Date.now()}`;
  const stagedKey = `${targetKey}.spartan-rotation-${token}.tmp`;
  const stagedCert = `${targetCert}.spartan-rotation-${token}.tmp`;
  const backupKey = `${targetKey}.spartan-rotation-${token}.bak`;
  const backupCert = `${targetCert}.spartan-rotation-${token}.bak`;
  let keyBackedUp = false;
  let certBackedUp = false;
  let keyPublished = false;
  let certPublished = false;
  try {
    await fsImpl.writeFile(stagedKey, keyPem, { encoding: 'utf8', mode: 0o600 });
    await fsImpl.chmod(stagedKey, 0o600);
    await fsImpl.writeFile(stagedCert, certPem, { encoding: 'utf8', mode: 0o644 });
    await fsImpl.chmod(stagedCert, 0o644);
    try {
      await fsImpl.rename(targetKey, backupKey);
      keyBackedUp = true;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    try {
      await fsImpl.rename(targetCert, backupCert);
      certBackedUp = true;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    await fsImpl.rename(stagedKey, targetKey);
    keyPublished = true;
    await fsImpl.rename(stagedCert, targetCert);
    certPublished = true;
    if (keyBackedUp) await fsImpl.unlink(backupKey);
    if (certBackedUp) await fsImpl.unlink(backupCert);
    return Object.freeze({
      status: 'rotated',
      keyPath: targetKey,
      certPath: targetCert,
      certificate: inspection,
    });
  } catch (error) {
    if (keyPublished) {
      try {
        await fsImpl.unlink(targetKey);
      } catch {}
    }
    if (certPublished) {
      try {
        await fsImpl.unlink(targetCert);
      } catch {}
    }
    if (keyBackedUp) {
      try {
        await fsImpl.rename(backupKey, targetKey);
      } catch {}
    }
    if (certBackedUp) {
      try {
        await fsImpl.rename(backupCert, targetCert);
      } catch {}
    }
    throw error;
  } finally {
    for (const file of [stagedKey, stagedCert, backupKey, backupCert]) {
      try {
        await fsImpl.unlink(file);
      } catch {}
    }
  }
}

function option(argv, name) {
  const index = argv.indexOf(name);
  return index < 0 ? '' : argv[index + 1];
}
if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || '')) {
  try {
    const keyPath = required(option(process.argv.slice(2), '--key'), '--key');
    const certPath = required(option(process.argv.slice(2), '--cert'), '--cert');
    const keyPem = await readFile(keyPath, 'utf8');
    const certPem = await readFile(certPath, 'utf8');
    console.log(
      JSON.stringify({
        status: 'valid',
        keyPath: path.resolve(keyPath),
        certPath: path.resolve(certPath),
        certificate: inspectTlsCertificatePair({ keyPem, certPem }),
      }),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
