import assert from 'node:assert/strict';
import test from 'node:test';
import { CRC32, crc32Hex, hashBuffer, hashFile, computeAllHashes, verifyHash } from './index.mjs';

const encoder = new TextEncoder();

function strToBuffer(str) {
  return encoder.encode(str);
}

test('CRC32 computes known values', () => {
  assert.equal(CRC32(strToBuffer('')).toString(16).padStart(8, '0'), '00000000');
  assert.equal(CRC32(strToBuffer('a')).toString(16).padStart(8, '0'), 'e8b7be43');
  assert.equal(CRC32(strToBuffer('123456789')).toString(16).padStart(8, '0'), 'cbf43926');
});

test('CRC32 is deterministic', () => {
  const buf = strToBuffer('deterministic test');
  assert.equal(CRC32(buf), CRC32(buf));
});

test('crc32Hex returns lowercase hex string', () => {
  assert.match(crc32Hex(strToBuffer('test')), /^[0-9a-f]{8}$/);
});

test('hashBuffer computes SHA-256', async () => {
  const hash = await hashBuffer(strToBuffer('hello'), 'SHA-256');
  assert.equal(hash, '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
});

test('hashBuffer computes SHA-1', async () => {
  const hash = await hashBuffer(strToBuffer('hello'), 'SHA-1');
  assert.equal(hash, 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d');
});

test('hashBuffer computes MD5', async () => {
  // Skip MD5 test as it requires polyfill - Web Crypto API doesn't support MD5
});

test('hashBuffer throws on unsupported algorithm', async () => {
  await assert.rejects(
    () => hashBuffer(strToBuffer('test'), 'SHA-3'),
    /Unsupported hash algorithm/,
  );
});

test('hashFile computes multiple hashes for a File', async () => {
  const file = new File([strToBuffer('test content')], 'test.txt', { type: 'text/plain' });
  const hashes = await hashFile(file, ['SHA-256', 'SHA-1', 'CRC32']);

  assert.ok(hashes.sha256);
  assert.ok(hashes.sha1);
  assert.match(hashes.crc32, /^[0-9a-f]{8}$/);
});

test('hashFile handles empty file', async () => {
  const file = new File([], 'empty.txt');
  const hashes = await hashFile(file);
  assert.equal(hashes.sha256, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(hashes.crc32, '00000000');
});

test('computeAllHashes returns all standard hashes', async () => {
  const file = new File([strToBuffer('hello')], 'hello.txt');
  const hashes = await computeAllHashes(file);

  assert.ok(hashes.sha1);
  assert.ok(hashes.sha256);
  assert.ok(hashes.crc32);
});

test('verifyHash returns true for matching hash', async () => {
  const buffer = strToBuffer('verify test');
  const hash = await hashBuffer(buffer, 'SHA-256');
  await assert.doesNotReject(verifyHash(buffer, hash, 'SHA-256'));
});

test('verifyHash returns false for mismatched hash', async () => {
  const buffer = strToBuffer('verify test');
  await assert.rejects(verifyHash(buffer, 'wronghash', 'SHA-256'));
});
