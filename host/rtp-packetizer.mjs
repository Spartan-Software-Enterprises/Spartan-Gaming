const CODECS = new Set(['h264', 'vp9', 'av1', 'opus']);
const CLOCK_RATES = Object.freeze({h264: 90000, vp9: 90000, av1: 90000, opus: 48000});
const DEFAULT_MTU = 1200;

function boundedInteger(value, fallback, minimum, maximum, name) {
  const result = Number.isInteger(value) ? value : fallback;
  if (result < minimum || result > maximum) throw new RangeError(`${name} must be between ${minimum} and ${maximum}`);
  return result;
}

function bytes(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  throw new TypeError('encoded media must be a Buffer or Uint8Array');
}

function startCodeLength(value, offset) {
  if (value[offset] !== 0 || value[offset + 1] !== 0) return 0;
  if (value[offset + 2] === 1) return 3;
  if (value[offset + 2] === 0 && value[offset + 3] === 1) return 4;
  return 0;
}

function h264Nalus(value) {
  const nalus = [];
  let cursor = 0;
  while (cursor < value.length) {
    const code = startCodeLength(value, cursor);
    if (!code) break;
    cursor += code;
    const next = (() => {
      for (let index = cursor; index < value.length; index += 1) if (startCodeLength(value, index)) return index;
      return value.length;
    })();
    if (next > cursor) nalus.push(value.subarray(cursor, next));
    cursor = next;
  }
  if (nalus.length) return nalus;
  if (value.length >= 4) {
    const avcc = [];
    let offset = 0;
    while (offset + 4 <= value.length) {
      const length = value.readUInt32BE(offset); offset += 4;
      if (!length || offset + length > value.length) break;
      avcc.push(value.subarray(offset, offset + length)); offset += length;
    }
    if (avcc.length && offset === value.length) return avcc;
  }
  return value.length ? [value] : [];
}

function packetFactory({RtpPacket, RtpHeader, payload, marker, payloadType, sequenceNumber, timestamp, ssrc}) {
  const headerValues = {version: 2, marker, payloadType, sequenceNumber, timestamp: timestamp >>> 0, ssrc: ssrc >>> 0, csrc: [], extensions: []};
  const header = typeof RtpHeader === 'function' ? new RtpHeader(headerValues) : headerValues;
  return typeof RtpPacket === 'function' ? new RtpPacket(header, payload) : {header, payload};
}

function fragment(value, size, callback) {
  const output = [];
  for (let offset = 0; offset < value.length; offset += size) {
    const end = Math.min(value.length, offset + size);
    output.push(callback(value.subarray(offset, end), offset === 0, end === value.length));
  }
  return output;
}

function packetizeH264(value, {maxPayload, make, timestamp}) {
  const output = [];
  const nalus = h264Nalus(value);
  nalus.forEach((nalu, naluIndex) => {
    if (!nalu.length) return;
    const lastNalu = naluIndex === nalus.length - 1;
    if (nalu.length <= maxPayload) {
      output.push(make(nalu, lastNalu));
      return;
    }
    if (nalu.length < 2) throw new Error('H.264 NAL unit is too short to fragment');
    const indicator = (nalu[0] & 0xe0) | 28;
    const nalHeader = nalu[0] & 0x1f;
    output.push(...fragment(nalu.subarray(1), maxPayload - 2, (part, first, last) => {
      const fuHeader = nalHeader | (first ? 0x80 : 0) | (last ? 0x40 : 0);
      return make(Buffer.concat([Buffer.from([indicator, fuHeader]), part]), last && lastNalu);
    }));
  });
  return output;
}

/** Extract frame payloads from an On2 IVF container (`ffmpeg -f ivf` output) when present. */
function ivfFrames(value) {
  if (value.length < 32 || value.toString('latin1', 0, 4) !== 'DKIF') return null;
  const frames = [];
  const rate = value.readUInt32LE(16);
  const scale = value.readUInt32LE(20);
  let offset = 32;
  while (offset + 12 <= value.length) {
    const size = value.readUInt32LE(offset);
    const timestamp = value.readBigUInt64LE(offset + 4);
    offset += 12;
    if (!size || offset + size > value.length) break;
    const rtpTimestamp = rate && scale ? Number((timestamp * BigInt(scale) * 90000n / BigInt(rate)) & 0xffffffffn) : Number(timestamp & 0xffffffffn);
    frames.push(Object.freeze({payload: value.subarray(offset, offset + size), timestamp: rtpTimestamp})); offset += size;
  }
  return frames.length ? frames : null;
}

function packetizeDescriptor(value, {maxPayload, make, descriptor}) {
  const descriptorSize = descriptor(true, true).length;
  if (value.length <= maxPayload - descriptorSize) return [make(Buffer.concat([descriptor(true, true), value]), true)];
  return fragment(value, maxPayload - descriptorSize, (part, first, last) => make(Buffer.concat([descriptor(first, last), part]), last));
}

/**
 * Create a small dependency-free RTP packetizer for encoded native media.
 * H.264 accepts Annex-B and AVCC frames and uses RFC 6184 single-NAL/FU-A
 * framing. VP9 uses the minimal RFC 9628 payload descriptor, AV1 uses the
 * one-OBU aggregation form, and Opus preserves each encoded frame as one RTP
 * payload. The returned packets are Werift-compatible when its RtpPacket and
 * RtpHeader constructors are supplied; tests and alternate transports receive
 * the same `{header, payload}` shape.
 */
export function createRtpPacketizer({codec = 'h264', ssrc = 1, payloadType = 96, mtu = DEFAULT_MTU, RtpPacket, RtpHeader} = {}) {
  if (!CODECS.has(codec)) throw new TypeError(`unsupported RTP packetizer codec: ${codec}`);
  const maxPayload = boundedInteger(mtu, DEFAULT_MTU, 256, 65535, 'mtu') - 12;
  const source = {sequence: 0, clockRate: CLOCK_RATES[codec], av1SequenceStarted: false};
  const make = (payload, marker, timestamp) => packetFactory({RtpPacket, RtpHeader, payload, marker, payloadType, sequenceNumber: source.sequence++ & 0xffff, timestamp, ssrc});
  return Object.freeze({
    codec,
    clockRate: source.clockRate,
    get sequenceNumber() { return source.sequence & 0xffff; },
    push(chunk, {timestamp = 0, newCodedVideoSequence = false} = {}) {
      const value = bytes(chunk);
      const time = Number.isFinite(timestamp) ? timestamp : 0;
      if (!value.length) return [];
      if (codec === 'h264') return packetizeH264(value, {maxPayload, timestamp: time, make: (payload, marker) => make(payload, marker, time)});
      if (codec === 'opus') {
        if (value.length > maxPayload) throw new Error('Opus frame exceeds RTP packetizer payload limit');
        return [make(value, true, time)];
      }
      const frames = codec === 'vp9' ? (ivfFrames(value) || [Object.freeze({payload: value, timestamp: time})]) : [Object.freeze({payload: value, timestamp: time})];
      const output = [];
      for (const frame of frames) {
        if (!frame.payload.length) continue;
        if (codec === 'vp9') output.push(...packetizeDescriptor(frame.payload, {maxPayload, make: (payload, marker) => make(payload, marker, frame.timestamp), descriptor: (first, last) => Buffer.from([(first ? 0x08 : 0) | (last ? 0x04 : 0)])}));
        else {
          const sequenceStart = !source.av1SequenceStarted || newCodedVideoSequence === true;
          output.push(...packetizeDescriptor(frame.payload, {maxPayload, make: (payload, marker) => make(payload, marker, frame.timestamp), descriptor: (first, last) => Buffer.from([(first ? 0 : 0x80) | (last ? 0 : 0x40) | 0x10 | (sequenceStart && first ? 0x08 : 0)])}));
          source.av1SequenceStarted = true;
        }
      }
      return output;
    },
  });
}

export const rtpPacketizerCodecs = Object.freeze([...CODECS]);
