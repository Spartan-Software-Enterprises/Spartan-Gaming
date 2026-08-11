import assert from 'node:assert/strict';
import test from 'node:test';
import { createRtpPacketizer } from './rtp-packetizer.mjs';

function nal(size, type = 5) {
  return Buffer.concat([Buffer.from([type]), Buffer.alloc(size - 1, 0xab)]);
}

test('H.264 packetizer emits one RTP packet for a small Annex-B frame', () => {
  const packetizer = createRtpPacketizer({ codec: 'h264', ssrc: 7, payloadType: 102 });
  const packets = packetizer.push(Buffer.concat([Buffer.from([0, 0, 0, 1]), nal(12)]), {
    timestamp: 90000,
  });
  assert.equal(packets.length, 1);
  assert.equal(packets[0].header.marker, true);
  assert.equal(packets[0].header.payloadType, 102);
  assert.equal(packets[0].header.timestamp, 90000);
  assert.equal(packets[0].payload[0], 5);
  assert.equal(packets[0].header.ssrc, 7);
});

test('H.264 packetizer fragments oversized NAL units with FU-A boundaries', () => {
  const packetizer = createRtpPacketizer({ codec: 'h264', mtu: 256 });
  const packets = packetizer.push(nal(600), { timestamp: 1500 });
  assert.ok(packets.length > 2);
  assert.equal(packets[0].payload[0] & 0x1f, 28);
  assert.equal(Boolean(packets[0].payload[1] & 0x80), true);
  assert.equal(Boolean(packets.at(-1).payload[1] & 0x40), true);
  assert.equal(packets.at(-1).header.marker, true);
  assert.ok(packets.every((packet) => packet.payload.length <= 244));
});

test('H.264 packetizer accepts AVCC length-prefixed frames and preserves timestamp per frame', () => {
  const frame = nal(20, 1);
  const input = Buffer.concat([Buffer.alloc(4), frame]);
  input.writeUInt32BE(frame.length, 0);
  const packets = createRtpPacketizer().push(input, { timestamp: 3000 });
  assert.equal(packets.length, 1);
  assert.equal(packets[0].payload[0], 1);
  assert.equal(packets[0].header.timestamp, 3000);
});

test('VP9 and AV1 packetizers produce bounded RTP payloads', () => {
  for (const codec of ['vp9', 'av1']) {
    const packet = createRtpPacketizer({ codec }).push(Buffer.from('encoded-frame'), {
      timestamp: 42,
    })[0];
    assert.equal(packet.header.marker, true);
    assert.equal(packet.header.timestamp, 42);
    assert.ok(packet.payload.length < 1200);
  }
});

test('VP9 packetizer uses B and E bits for fragmented frame boundaries', () => {
  const packets = createRtpPacketizer({ codec: 'vp9', mtu: 256 }).push(Buffer.alloc(500), {
    timestamp: 42,
  });
  assert.equal(packets[0].payload[0] & 0x0c, 0x08);
  assert.equal(packets.at(-1).payload[0] & 0x0c, 0x04);
  assert.equal(packets[0].payload.length, 244);
  assert.ok(packets.every((packet) => (packet.payload[0] & 0x82) === 0));
});

test('AV1 packetizer signals only coded sequence starts', () => {
  const packetizer = createRtpPacketizer({ codec: 'av1' });
  const first = packetizer.push(Buffer.from('first'))[0];
  const next = packetizer.push(Buffer.from('next'))[0];
  const restarted = packetizer.push(Buffer.from('restart'), { newCodedVideoSequence: true })[0];
  assert.equal(first.payload[0] & 0x18, 0x18);
  assert.equal(next.payload[0] & 0x18, 0x10);
  assert.equal(restarted.payload[0] & 0x18, 0x18);
});

test('Opus packetizer preserves an encoded frame without a video payload descriptor', () => {
  const frame = Buffer.from([0xf8, 0xff, 0xfe, 0x00]);
  const packetizer = createRtpPacketizer({ codec: 'opus', mtu: 256 });
  const [packet] = packetizer.push(frame, { timestamp: 42 });
  assert.equal(packet.header.marker, true);
  assert.equal(packet.header.timestamp, 42);
  assert.deepEqual(packet.payload, frame);
  assert.throws(() => packetizer.push(Buffer.alloc(245)), /Opus frame exceeds/);
});

test('VP9 packetizer extracts On2 IVF frames from ffmpeg -f ivf output', () => {
  const frameA = Buffer.from('vp9-frame-a');
  const frameB = Buffer.from('vp9-frame-b');
  const header = Buffer.alloc(32);
  header.write('DKIF', 0, 'latin1');
  header.writeUInt32LE(90000, 16);
  header.writeUInt32LE(1, 20);
  const sizeA = Buffer.alloc(4);
  sizeA.writeUInt32LE(frameA.length, 0);
  const sizeB = Buffer.alloc(4);
  sizeB.writeUInt32LE(frameB.length, 0);
  const timestampA = Buffer.alloc(8);
  timestampA.writeBigUInt64LE(42n);
  const timestampB = Buffer.alloc(8);
  timestampB.writeBigUInt64LE(84n);
  const input = Buffer.concat([header, sizeA, timestampA, frameA, sizeB, timestampB, frameB]);
  const packets = createRtpPacketizer({ codec: 'vp9' }).push(input, { timestamp: 42 });
  assert.equal(packets.length, 2);
  assert.equal(packets[0].payload.subarray(1).toString(), 'vp9-frame-a');
  assert.equal(packets[1].payload.subarray(1).toString(), 'vp9-frame-b');
  assert.equal(packets[0].payload[0] & 0x0c, 0x0c);
  assert.equal(packets[0].payload[0] & 0x82, 0);
  assert.equal(packets[0].header.timestamp, 42);
  assert.equal(packets[1].header.timestamp, 84);
  assert.equal(packets[0].header.marker, true);
  assert.equal(packets[1].header.marker, true);
});

test('packetizer can construct real Werift-shaped packets through injected constructors', () => {
  class Header {
    constructor(values) {
      Object.assign(this, values);
    }
  }
  class Packet {
    constructor(header, payload) {
      this.header = header;
      this.payload = payload;
    }
  }
  const packet = createRtpPacketizer({ RtpHeader: Header, RtpPacket: Packet }).push(
    Buffer.from([1, 2, 3]),
  )[0];
  assert.equal(packet.constructor, Packet);
  assert.equal(packet.header.constructor, Header);
  assert.equal(packet.header.version, 2);
});
