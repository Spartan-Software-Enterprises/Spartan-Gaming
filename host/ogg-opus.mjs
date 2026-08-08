const DEFAULT_MAX_BUFFERED_BYTES = 1024 * 1024;

function input(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  throw new TypeError('Ogg Opus input must be a Buffer or Uint8Array');
}

/** Extract complete Opus packets from a streaming Ogg Opus byte sequence. */
export function createOggOpusPacketExtractor({maxBufferedBytes = DEFAULT_MAX_BUFFERED_BYTES} = {}) {
  const limit = Number.isInteger(maxBufferedBytes) && maxBufferedBytes >= 65536 ? maxBufferedBytes : DEFAULT_MAX_BUFFERED_BYTES;
  let pending = Buffer.alloc(0);
  let packetParts = [];
  let packetBytes = 0;
  return Object.freeze({
    push(chunk) {
      pending = Buffer.concat([pending, input(chunk)]);
      if (pending.length > limit) throw new Error('Ogg Opus input exceeds the buffered byte limit');
      const packets = [];
      while (pending.length >= 27) {
        if (pending.toString('latin1', 0, 4) !== 'OggS' || pending[4] !== 0) throw new Error('invalid Ogg Opus page');
        const segmentCount = pending[26];
        if (pending.length < 27 + segmentCount) break;
        let payloadBytes = 0;
        for (let index = 0; index < segmentCount; index += 1) payloadBytes += pending[27 + index];
        const pageBytes = 27 + segmentCount + payloadBytes;
        if (pending.length < pageBytes) break;
        const continued = Boolean(pending[5] & 0x01);
        if (continued !== (packetParts.length > 0)) throw new Error('invalid Ogg Opus packet continuation');
        let offset = 27 + segmentCount;
        for (let index = 0; index < segmentCount; index += 1) {
          const size = pending[27 + index];
          packetParts.push(pending.subarray(offset, offset + size)); packetBytes += size; offset += size;
          if (packetBytes > limit) throw new Error('Ogg Opus packet exceeds the buffered byte limit');
          if (size < 255) {
            const packet = Buffer.concat(packetParts, packetBytes); packetParts = []; packetBytes = 0;
            if (!packet.subarray(0, 8).equals(Buffer.from('OpusHead')) && !packet.subarray(0, 8).equals(Buffer.from('OpusTags'))) packets.push(packet);
          }
        }
        pending = pending.subarray(pageBytes);
      }
      return Object.freeze(packets);
    },
  });
}
