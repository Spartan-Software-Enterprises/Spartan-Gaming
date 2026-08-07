import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createSessionEnvelope} from '../src/frontend/session/session.mjs';
import {createSignalingServer} from './agent.mjs';
import test from 'node:test';
import net from 'node:net';

function clientFrame(value) {
  const body = Buffer.from(JSON.stringify(value)); const mask = randomBytes(4); const masked = Buffer.from(body);
  for (let index = 0; index < masked.length; index += 1) masked[index] ^= mask[index % 4];
  if (body.length < 126) return Buffer.concat([Buffer.from([0x81, 0x80 | body.length]), mask, masked]);
  const header = Buffer.alloc(4); header[0] = 0x81; header[1] = 0x80 | 126; header.writeUInt16BE(body.length, 2); return Buffer.concat([header, mask, masked]);
}

function parseServerFrames(buffer, emit) {
  let cursor = 0;
  while (buffer.length - cursor >= 2) {
    const first = buffer[cursor]; const second = buffer[cursor + 1]; let length = second & 0x7f; let header = 2;
    if (length === 126) { if (buffer.length - cursor < 4) break; length = buffer.readUInt16BE(cursor + 2); header = 4; }
    if (length === 127 || buffer.length - cursor < header + length) break;
    const payload = buffer.subarray(cursor + header, cursor + header + length); cursor += header + length;
    if ((first & 0x0f) === 0x1) emit(JSON.parse(payload.toString('utf8')));
  }
  return buffer.subarray(cursor);
}

function connect(port) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({host: '127.0.0.1', port}); let buffer = Buffer.alloc(0); let handshake = false; const messages = []; const waiters = [];
    const push = value => { const waiter = waiters.shift(); if (waiter) waiter(value); else messages.push(value); };
    const next = () => new Promise((resolveNext, rejectNext) => { if (messages.length) return resolveNext(messages.shift()); const timer = setTimeout(() => rejectNext(new Error('signaling message timed out after 10 seconds')), 10_000); waiters.push(value => { clearTimeout(timer); resolveNext(value); }); });
    socket.on('error', reject); socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      if (!handshake) { const end = buffer.indexOf('\r\n\r\n'); if (end < 0) return; const response = buffer.subarray(0, end).toString(); assert.match(response, /101 Switching Protocols/); buffer = buffer.subarray(end + 4); handshake = true; resolve({send: value => socket.write(clientFrame(value)), next, close: () => socket.destroy()}); }
      buffer = parseServerFrames(buffer, push);
    });
    socket.once('connect', () => { socket.setNoDelay?.(true); const key = randomBytes(16).toString('base64'); socket.write(`GET /signal HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: ${key}\r\n\r\n`); });
  });
}

test('reference signaling service routes authenticated client and host envelopes over real WebSockets', async () => {
  const service = createSignalingServer({secret: 'integration-secret', bind: '127.0.0.1', port: 0}); const sessionId = 'ses-signal-01';
  let client; let host;
  try {
    const address = await service.start(); const clientTicket = service.broker.issueTicket({sessionId, role: 'client', subject: 'browser'}); const hostTicket = service.broker.issueTicket({sessionId, role: 'host', subject: 'host'});
    client = await connect(address.port); host = await connect(address.port);
    client.send({type: 'signaling.join', sessionId, role: 'client', ticket: clientTicket}); host.send({type: 'signaling.join', sessionId, role: 'host', ticket: hostTicket}); await new Promise(resolve => setTimeout(resolve, 25));
    const offer = createSessionEnvelope({sessionId, type: 'session.offer', payload: {sdp: {type: 'offer', sdp: 'offer'}, transports: ['webrtc'], video: {codecs: ['h264']}, audio: {codecs: ['opus']}, input: {gamepad: true}}}); client.send(offer); assert.deepEqual(await host.next(), offer);
    const answer = createSessionEnvelope({sessionId, type: 'session.answer', sequence: 1, payload: {accepted: true, capabilities: {transports: ['webrtc'], video: {codecs: ['h264'], maxWidth: 1280, maxHeight: 720, maxFramerate: 60}, audio: {codecs: ['opus'], channels: 2}, input: {gamepad: true}}}}); host.send(answer); assert.deepEqual(await client.next(), answer);
    const health = await fetch(`http://127.0.0.1:${address.port}/health`).then(response => response.json()); assert.equal(health.sessions, 1); assert.equal(health.participants, 2); assert.equal(health.connections, 2);
  } finally { client?.close(); host?.close(); await service.close(); }
});
