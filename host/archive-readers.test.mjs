import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import test from 'node:test';
import { createArchiveReader, createTarReader, createZipReader } from './archive-readers.mjs';

function tarEntry(path, content, type = '0') {
  const header = new Uint8Array(512);
  header.set(new TextEncoder().encode(path), 0);
  header.set(new TextEncoder().encode(content.length.toString(8).padStart(11, '0')), 124);
  header[156] = type.charCodeAt(0);
  return { header, content: new TextEncoder().encode(content) };
}
function tar(entries) {
  const blocks = [];
  for (const entry of entries) {
    blocks.push(
      entry.header,
      entry.content,
      new Uint8Array((512 - (entry.content.length % 512)) % 512),
    );
  }
  blocks.push(new Uint8Array(1024));
  const output = new Uint8Array(blocks.reduce((sum, block) => sum + block.length, 0));
  let offset = 0;
  for (const block of blocks) {
    output.set(block, offset);
    offset += block.length;
  }
  return output;
}
function zip(content, encrypted = false) {
  const name = new TextEncoder().encode('bin/adapter');
  const compressed = deflateRawSync(content);
  const local = new Uint8Array(30 + name.length + compressed.length);
  const central = new Uint8Array(46 + name.length);
  const put16 = (data, offset, value) => {
    data[offset] = value & 255;
    data[offset + 1] = value >>> 8;
  };
  const put32 = (data, offset, value) => {
    data[offset] = value & 255;
    data[offset + 1] = (value >>> 8) & 255;
    data[offset + 2] = (value >>> 16) & 255;
    data[offset + 3] = value >>> 24;
  };
  put32(local, 0, 0x04034b50);
  put16(local, 6, encrypted ? 1 : 0);
  put16(local, 8, 8);
  put32(local, 18, compressed.length);
  put32(local, 22, content.length);
  put16(local, 26, name.length);
  local.set(name, 30);
  local.set(compressed, 30 + name.length);
  put32(central, 0, 0x02014b50);
  put16(central, 8, encrypted ? 1 : 0);
  put16(central, 10, 8);
  put32(central, 20, compressed.length);
  put32(central, 24, content.length);
  put16(central, 28, name.length);
  central.set(name, 46);
  const end = new Uint8Array(22);
  put32(end, 0, 0x06054b50);
  put16(end, 8, 1);
  put16(end, 10, 1);
  put32(end, 12, central.length);
  put32(end, 16, local.length);
  const output = new Uint8Array(local.length + central.length + end.length);
  output.set(local, 0);
  output.set(central, local.length);
  output.set(end, local.length + central.length);
  return output;
}

test('TAR reader lists regular files/directories and rejects links', () => {
  const reader = createTarReader(
    tar([tarEntry('bin/adapter', 'hello'), tarEntry('bin/', '', '5')]),
  );
  assert.equal(new TextDecoder().decode(reader.read('bin/adapter')), 'hello');
  assert.equal(reader.list().find((entry) => entry.path === 'bin').type, 'directory');
  assert.throws(() => createTarReader(tar([tarEntry('link', '', '2')])), /links/);
});
test('ZIP reader reads stored/deflated content and rejects encrypted entries', () => {
  const content = new TextEncoder().encode('zip payload');
  const reader = createZipReader(zip(content));
  assert.equal(new TextDecoder().decode(reader.read('bin/adapter')), 'zip payload');
  assert.equal(reader.list()[0].sizeBytes, content.length);
  assert.throws(() => createZipReader(zip(content, true)), /encrypted/);
});
test('archive reader dispatches supported formats and fails closed for unavailable codecs', () => {
  assert.equal(
    createArchiveReader({ format: 'tar', data: tar([tarEntry('a', 'b')]) }).format,
    'tar',
  );
  assert.equal(
    createArchiveReader({ format: 'zip', data: zip(new TextEncoder().encode('b')) }).format,
    'zip',
  );
  assert.throws(
    () => createArchiveReader({ format: 'tar.zst', data: new Uint8Array() }),
    /no built-in/,
  );
});
