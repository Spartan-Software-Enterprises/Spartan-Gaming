import { inflateRawSync } from 'node:zlib';

const MAX_ENTRIES = 100_000;
const MAX_ENTRY_BYTES = 5_000_000_000;

function bytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  throw new TypeError('archive data must be Uint8Array or ArrayBuffer');
}
function u16(data, offset) {
  return data[offset] | (data[offset + 1] << 8);
}
function u32(data, offset) {
  return (
    (data[offset] |
      (data[offset + 1] << 8) |
      (data[offset + 2] << 16) |
      (data[offset + 3] << 24)) >>>
    0
  );
}
function text(data, start, length) {
  return new TextDecoder().decode(data.subarray(start, start + length)).replace(/\0+$/, '');
}
function safePath(path) {
  const normalized = path.replaceAll('\\', '/');
  if (
    !normalized ||
    normalized.startsWith('/') ||
    normalized.split('/').includes('..') ||
    normalized.includes('\0')
  )
    throw new Error(`unsafe archive path: ${path}`);
  return normalized.replace(/\/$/, '');
}
function directory(path) {
  return path.endsWith('/');
}
function entryMap(entries) {
  if (entries.length > MAX_ENTRIES) throw new RangeError('archive contains too many entries');
  const map = new Map();
  for (const entry of entries) {
    if (map.has(entry.path)) throw new Error(`duplicate archive path: ${entry.path}`);
    map.set(entry.path, Object.freeze(entry));
  }
  return map;
}

export function createTarReader(input) {
  const data = bytes(input);
  const entries = [];
  let offset = 0;
  let zeroBlocks = 0;
  while (offset + 512 <= data.byteLength) {
    const header = data.subarray(offset, offset + 512);
    offset += 512;
    if (header.every((value) => value === 0)) {
      zeroBlocks += 1;
      if (zeroBlocks === 2) break;
      continue;
    }
    zeroBlocks = 0;
    const path = safePath(text(header, 0, 100));
    const sizeText = text(header, 124, 12).trim().replace(/\0/g, '');
    const size = sizeText ? parseInt(sizeText, 8) : 0;
    const type = String.fromCharCode(header[156] || 48);
    if (
      !Number.isSafeInteger(size) ||
      size < 0 ||
      size > MAX_ENTRY_BYTES ||
      offset + size > data.byteLength
    )
      throw new Error(`invalid TAR entry size: ${path}`);
    if (type === '2' || type === '1') throw new Error(`archive links are not allowed: ${path}`);
    if (!['0', '\0', '5'].includes(type)) throw new Error(`unsupported TAR entry type: ${path}`);
    const dataOffset = offset;
    const isDirectory = type === '5' || directory(path);
    entries.push({
      path,
      type: isDirectory ? 'directory' : 'file',
      sizeBytes: isDirectory ? 0 : size,
      read: () => data.slice(dataOffset, dataOffset + size),
    });
    offset += Math.ceil(size / 512) * 512;
  }
  const map = entryMap(entries);
  return Object.freeze({
    format: 'tar',
    list: () => Object.freeze([...map.values()].map(({ read, ...entry }) => Object.freeze(entry))),
    read(path) {
      const entry = map.get(safePath(path));
      if (!entry || entry.type !== 'file') throw new Error(`archive file is unavailable: ${path}`);
      return entry.read();
    },
  });
}

function findEndOfCentralDirectory(data) {
  for (
    let offset = data.byteLength - 22;
    offset >= Math.max(0, data.byteLength - 65_557);
    offset -= 1
  )
    if (u32(data, offset) === 0x06054b50) return offset;
  throw new Error('ZIP end-of-central-directory record not found');
}

export function createZipReader(input) {
  const data = bytes(input);
  const eocd = findEndOfCentralDirectory(data);
  const count = u16(data, eocd + 10);
  const centralSize = u32(data, eocd + 12);
  const centralOffset = u32(data, eocd + 16);
  if (count > MAX_ENTRIES || centralOffset + centralSize > data.byteLength)
    throw new Error('invalid ZIP central directory');
  const entries = [];
  let offset = centralOffset;
  for (let index = 0; index < count; index += 1) {
    if (u32(data, offset) !== 0x02014b50) throw new Error('invalid ZIP central directory entry');
    const flags = u16(data, offset + 8);
    const method = u16(data, offset + 10);
    const compressedSize = u32(data, offset + 20);
    const uncompressedSize = u32(data, offset + 24);
    const nameLength = u16(data, offset + 28);
    const extraLength = u16(data, offset + 30);
    const commentLength = u16(data, offset + 32);
    const localOffset = u32(data, offset + 42);
    const path = safePath(text(data, offset + 46, nameLength));
    if (flags & 1) throw new Error(`encrypted ZIP entries are not allowed: ${path}`);
    if (uncompressedSize > MAX_ENTRY_BYTES || localOffset + 30 > data.byteLength)
      throw new Error(`invalid ZIP entry size: ${path}`);
    const mode = (u32(data, offset + 38) >>> 16) & 0xf000;
    if (mode === 0xa000) throw new Error(`archive links are not allowed: ${path}`);
    const localNameLength = u16(data, localOffset + 26);
    const localExtraLength = u16(data, localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const end = start + compressedSize;
    if (end > data.byteLength) throw new Error(`invalid ZIP payload: ${path}`);
    const isDirectory = directory(path) || mode === 0x4000;
    entries.push({
      path,
      type: isDirectory ? 'directory' : 'file',
      sizeBytes: isDirectory ? 0 : uncompressedSize,
      read: () => {
        if (isDirectory) throw new Error(`archive file is unavailable: ${path}`);
        if (method === 0) return data.slice(start, end);
        if (method === 8) return new Uint8Array(inflateRawSync(data.slice(start, end)));
        throw new Error(`unsupported ZIP compression method: ${method}`);
      },
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  const map = entryMap(entries);
  return Object.freeze({
    format: 'zip',
    list: () => Object.freeze([...map.values()].map(({ read, ...entry }) => Object.freeze(entry))),
    read(path) {
      const entry = map.get(safePath(path));
      if (!entry || entry.type !== 'file') throw new Error(`archive file is unavailable: ${path}`);
      return entry.read();
    },
  });
}

export function createArchiveReader({ format, data } = {}) {
  if (format === 'tar') return createTarReader(data);
  if (format === 'zip') return createZipReader(data);
  throw new Error(`no built-in archive reader for ${format}; provide a platform archive adapter`);
}
