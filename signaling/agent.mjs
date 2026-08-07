#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {createSignalingBroker} from './broker.mjs';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) { const value = process.argv[index]; if (value.startsWith('--')) args.set(value.slice(2), process.argv[index + 1]?.startsWith('--') ? true : process.argv[++index]); }
const secret = String(args.get('secret') || process.env.SPARTAN_SIGNALING_SECRET || '');
if (!secret) { console.error('Set SPARTAN_SIGNALING_SECRET or pass --secret; refusing to start without an authentication secret.'); process.exit(1); }
const bind = String(args.get('bind') || '127.0.0.1');
const port = Number(args.get('port') || 8790);
const broker = createSignalingBroker({secret});

function json(response, status, body) { response.writeHead(status, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'}); response.end(JSON.stringify(body)); }
function frame(text) { const body = Buffer.from(text); if (body.length < 126) return Buffer.concat([Buffer.from([0x81, body.length]), body]); if (body.length < 65536) { const header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(body.length, 2); return Buffer.concat([header, body]); } throw new Error('WebSocket message is too large'); }
function closeFrame() { return Buffer.from([0x88, 0x00]); }
function acceptKey(key) { return createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64'); }
function parseFrames(buffer, onMessage, socket) {
  let cursor = 0;
  while (buffer.length - cursor >= 2) {
    const first = buffer[cursor]; const second = buffer[cursor + 1]; const opcode = first & 0x0f; const masked = Boolean(second & 0x80); let length = second & 0x7f; let header = 2;
    if (length === 126) { if (buffer.length - cursor < 4) break; length = buffer.readUInt16BE(cursor + 2); header = 4; }
    if (length === 127 || !masked || length > 65536 || buffer.length - cursor < header + 4 + length) { if (length === 127 || !masked || length > 65536) socket.end(closeFrame()); return buffer.subarray(cursor); }
    const mask = buffer.subarray(cursor + header, cursor + header + 4); const payload = Buffer.from(buffer.subarray(cursor + header + 4, cursor + header + 4 + length));
    for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4];
    cursor += header + 4 + length;
    if (opcode === 0x8) { socket.end(closeFrame()); return buffer.subarray(cursor); }
    if (opcode === 0x9) { socket.write(Buffer.from([0x8a, 0])); continue; }
    if (opcode !== 0x1) { socket.end(closeFrame()); return Buffer.alloc(0); }
    onMessage(payload.toString('utf8'));
  }
  return buffer.subarray(cursor);
}

const server = createServer((request, response) => {
  if (request.url === '/health') return json(response, 200, {service: 'spartan-signaling-reference', version: 1, ...broker.stats()});
  json(response, 404, {error: 'not found'});
});
server.on('upgrade', (request, socket) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (url.pathname !== '/signal' || request.headers.upgrade?.toLowerCase() !== 'websocket' || !request.headers['sec-websocket-key']) { socket.end('HTTP/1.1 404 Not Found\r\n\r\n'); return; }
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${acceptKey(request.headers['sec-websocket-key'])}\r\n\r\n`);
  let buffer = Buffer.alloc(0); let participant;
  const reject = () => socket.end(closeFrame());
  socket.on('data', chunk => { buffer = parseFrames(Buffer.concat([buffer, chunk]), text => {
    try {
      const message = JSON.parse(text);
      if (!participant) {
        if (message?.type !== 'signaling.join') throw new Error('signaling join required');
        participant = broker.attach({sessionId: message.sessionId, role: message.role, ticket: message.ticket, send: value => socket.write(frame(JSON.stringify(value)))});
      } else participant.send(message);
    } catch { reject(); }
  }, socket); });
  socket.on('close', () => participant?.detach());
  socket.on('error', () => participant?.detach());
});
server.listen(port, bind, () => console.log(JSON.stringify({service: 'spartan-signaling-reference', endpoint: `ws://${bind}:${port}/signal`, health: `http://${bind}:${port}/health`, warning: 'Reference signaling only; use TLS, rate limits, origin policy, secret management, and STUN/TURN in production.'})));
