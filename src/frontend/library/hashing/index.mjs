const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[i] = c;
}

export function CRC32(buffer) {
  let crc = 0xffffffff;
  const view = new Uint8Array(buffer);
  for (let i = 0; i < view.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ view[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function crc32Hex(buffer) {
  return CRC32(buffer).toString(16).padStart(8, '0');
}

async function md5Hash(buffer) {
  const msg = new Uint8Array(buffer);
  let a = 0x67452301,
    b = 0xefcdab89,
    c = 0x98badcfe,
    d = 0x10325476;
  const K = new Uint32Array([
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
  ]);
  const S = new Uint8Array([
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9,
    14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ]);

  const msgLen = msg.length;
  const padLen = 64 - ((msgLen + 8) % 64);
  const padded = new Uint8Array(msgLen + padLen);
  padded.set(msg);
  padded[msgLen] = 0x80;
  const bitLen = BigInt(msgLen * 8);
  for (let i = 0; i < 8; i++) {
    padded[padded.length - 8 + i] = Number((bitLen >> BigInt(i * 8)) & 0xffn);
  }

  for (let i = 0; i < padded.length; i += 64) {
    const M = new Uint32Array(16);
    for (let j = 0; j < 16; j++) {
      const offset = i + j * 4;
      M[j] =
        padded[offset] |
        (padded[offset + 1] << 8) |
        (padded[offset + 2] << 16) |
        (padded[offset + 3] << 24);
    }
    let A = a,
      B = b,
      C = c,
      D = d;
    for (let j = 0; j < 64; j++) {
      let f, g;
      if (j < 16) {
        f = (B & C) | (~B & D);
        g = j;
      } else if (j < 32) {
        f = (D & B) | (~D & C);
        g = (5 * j + 1) % 16;
      } else if (j < 48) {
        f = B ^ C ^ D;
        g = (3 * j + 5) % 16;
      } else {
        f = C ^ (B | ~D);
        g = (7 * j) % 16;
      }
      const temp = D;
      D = C;
      C = B;
      B = (B + rotl(A + f + K[j] + M[g], S[j])) >>> 0;
      A = temp;
    }
    a = (a + A) >>> 0;
    b = (b + B) >>> 0;
    c = (c + C) >>> 0;
    d = (d + D) >>> 0;
  }

  return [a, b, c, d].map((x) => x.toString(16).padStart(8, '0')).join('');
}

function rotl(x, n) {
  return ((x << n) | (x >>> (32 - n))) >>> 0;
}

export async function hashBuffer(buffer, algorithm = 'SHA-256') {
  const algo = algorithm.toUpperCase();
  if (algo === 'MD5') {
    return md5Hash(buffer);
  }
  const cryptoAlgorithm = algorithmMap[algo];
  if (!cryptoAlgorithm) {
    throw new Error(`Unsupported hash algorithm: ${algorithm}`);
  }
  const hashBuffer = await crypto.subtle.digest(cryptoAlgorithm, buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashFile(file, algorithms = ['SHA-1', 'SHA-256', 'CRC32']) {
  const buffer = await file.arrayBuffer();
  const results = {};

  for (const algo of algorithms) {
    try {
      if (algo === 'CRC32') {
        results.crc32 = crc32Hex(buffer);
      } else {
        results[algo.toLowerCase().replace('-', '')] = await hashBuffer(buffer, algo);
      }
    } catch (error) {
      console.warn(`Hash ${algo} failed:`, error);
    }
  }

  return results;
}

export async function computeAllHashes(file) {
  return hashFile(file, ['SHA-1', 'SHA-256', 'CRC32']);
}

export function verifyHash(buffer, expectedHash, algorithm = 'SHA-256') {
  return hashBuffer(buffer, algorithm).then((h) => {
    const match = h.toLowerCase() === expectedHash.toLowerCase();
    if (!match) throw new Error('Hash mismatch');
    return true;
  });
}

const algorithmMap = {
  'SHA-1': 'SHA-1',
  'SHA-256': 'SHA-256',
  'SHA-384': 'SHA-384',
  'SHA-512': 'SHA-512',
};
