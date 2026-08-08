import assert from 'node:assert/strict';
import test from 'node:test';
import {createRtpPacketizer} from './rtp-packetizer.mjs';

function nal(size, type = 5) { return Buffer.concat([Buffer.from([type]), Buffer.alloc(size - 1, 0xab)]); }

test('H.264 packetizer emits one RTP packet for a small Annex-B frame', () => {
  const packetizer = createRtpPacketizer({codec: 'h264', ssrc: 7, payloadType: 102});
  const packets = packetizer.push(Buffer.concat([Buffer.from([0, 0, 0, 1]), nal(12)]), {timestamp: 90000});
  assert.equal(packets.length, 1); assert.equal(packets[0].header.marker, true); assert.equal(packets[0].header.payloadType, 102); assert.equal(packets[0].header.timestamp, 90000); assert.equal(packets[0].payload[0], 5); assert.equal(packets[0].header.ssrc, 7);
});

test('H.264 packetizer fragments oversized NAL units with FU-A boundaries', () => {
  const packetizer = createRtpPacketizer({codec: 'h264', mtu: 256});
  const packets = packetizer.push(nal(600), {timestamp: 1500});
  assert.ok(packets.length > 2); assert.equal(packets[0].payload[0] & 0x1f, 28); assert.equal(Boolean(packets[0].payload[1] & 0x80), true); assert.equal(Boolean(packets.at(-1).payload[1] & 0x40), true); assert.equal(packets.at(-1).header.marker, true); assert.ok(packets.every(packet => packet.payload.length <= 244));
});

test('H.264 packetizer accepts AVCC length-prefixed frames and preserves timestamp per frame', () => {
  const frame = nal(20, 1); const input = Buffer.concat([Buffer.alloc(4), frame]); input.writeUInt32BE(frame.length, 0);
  const packets = createRtpPacketizer().push(input, {timestamp: 3000});
  assert.equal(packets.length, 1); assert.equal(packets[0].payload[0], 1); assert.equal(packets[0].header.timestamp, 3000);
});

test('VP9, AV1, and Opus packetizers produce bounded RTP payloads', () => {
  for (const codec of ['vp9', 'av1', 'opus']) {
    const packet = createRtpPacketizer({codec}).push(Buffer.from('encoded-frame'), {timestamp: 42})[0];
    assert.equal(packet.header.marker, true); assert.equal(packet.header.timestamp, 42); assert.ok(packet.payload.length < 1200);
  }
});

test('packetizer can construct real Werift-shaped packets through injected constructors', () => {
  class Header { constructor(values) { Object.assign(this, values); } }
  class Packet { constructor(header, payload) { this.header = header; this.payload = payload; } }
  const packet = createRtpPacketizer({RtpHeader: Header, RtpPacket: Packet}).push(Buffer.from([1, 2, 3]))[0];
  assert.equal(packet.constructor, Packet); assert.equal(packet.header.constructor, Header); assert.equal(packet.header.version, 2);
});
