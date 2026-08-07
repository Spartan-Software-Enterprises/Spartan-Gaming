#!/usr/bin/env node
import {createHash, timingSafeEqual} from 'node:crypto';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createSignalingBroker} from './broker.mjs';

const DEFAULT_MAX_FRAME_BYTES = 64 * 1024;
const DEFAULT_MAX_CONNECTIONS = 256;
const DEFAULT_MAX_MESSAGES_PER_SECOND = 120;

function text(value) { return typeof value === 'string' ? value.trim() : ''; }
function positiveInteger(value, fallback, maximum) { const number = Number(value); return Number.isInteger(number) && number > 0 ? Math.min(number, maximum) : fallback; }
function portNumber(value, fallback = 8790) { const number = Number(value); return Number.isInteger(number) && number >= 0 && number <= 65535 ? number : fallback; }

export function normalizeServiceOptions(options = {}) {
  const allowedOrigins = Array.isArray(options.allowedOrigins) ? [...new Set(options.allowedOrigins.map(text).filter(Boolean))] : [];
  return Object.freeze({
    secret: text(options.secret), bind: text(options.bind) || '127.0.0.1', port: portNumber(options.port),
    adminSecret: text(options.adminSecret),
    allowedOrigins: Object.freeze(allowedOrigins), maxConnections: positiveInteger(options.maxConnections, DEFAULT_MAX_CONNECTIONS, 10000),
    maxMessagesPerSecond: positiveInteger(options.maxMessagesPerSecond, DEFAULT_MAX_MESSAGES_PER_SECOND, 10000), maxFrameBytes: positiveInteger(options.maxFrameBytes, DEFAULT_MAX_FRAME_BYTES, DEFAULT_MAX_FRAME_BYTES),
  });
}

export function isOriginAllowed(origin, allowedOrigins = []) { return !allowedOrigins.length || (typeof origin === 'string' && allowedOrigins.includes(origin)); }

export function createMessageRateLimiter({limit = DEFAULT_MAX_MESSAGES_PER_SECOND, windowMs = 1000, clock = () => Date.now()} = {}) {
  let startedAt = clock(); let count = 0;
  return Object.freeze({take() { const now = clock(); if (now - startedAt >= windowMs) { startedAt = now; count = 0; } count += 1; return count <= limit; }});
}

function parseArguments(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) { const value = argv[index]; if (!value?.startsWith('--')) continue; args.set(value.slice(2), argv[index + 1]?.startsWith('--') ? true : argv[++index]); }
  return args;
}

function frame(textValue, maxFrameBytes = DEFAULT_MAX_FRAME_BYTES) {
  const body = Buffer.from(textValue); if (body.length > maxFrameBytes) throw new Error('WebSocket message is too large');
  if (body.length < 126) return Buffer.concat([Buffer.from([0x81, body.length]), body]);
  const header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(body.length, 2); return Buffer.concat([header, body]);
}
function closeFrame() { return Buffer.from([0x88, 0x00]); }
function acceptKey(key) { return createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64'); }
function reject(socket, status = '400 Bad Request') { socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`); }
function json(response, status, body) { response.writeHead(status, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'}); response.end(JSON.stringify(body)); }
function adminAuthorized(request, secret) {
  if (!secret) return false;
  const value = request.headers.authorization || '';
  const token = value.startsWith('Bearer ') ? value.slice(7) : '';
  const expected = Buffer.from(secret); const actual = Buffer.from(token);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
function readBody(request, maximum = 4096) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0; let settled = false;
    const fail = error => { if (settled) return; settled = true; reject(error); };
    request.on('data', chunk => { size += chunk.length; if (size > maximum) { fail(new Error('request body is too large')); request.destroy(); return; } chunks.push(chunk); });
    request.on('end', () => { if (!settled) { settled = true; resolve(Buffer.concat(chunks).toString('utf8')); } });
    request.on('error', fail);
  });
}

export function parseFrames(buffer, onMessage, socket, maxFrameBytes = DEFAULT_MAX_FRAME_BYTES) {
  let cursor = 0;
  while (buffer.length - cursor >= 2) {
    const first = buffer[cursor]; const second = buffer[cursor + 1]; const opcode = first & 0x0f; const masked = Boolean(second & 0x80); let length = second & 0x7f; let header = 2;
    if (length === 126) { if (buffer.length - cursor < 4) break; length = buffer.readUInt16BE(cursor + 2); header = 4; }
    if (length === 127 || !masked || length > maxFrameBytes || buffer.length - cursor < header + 4 + length) { if (length === 127 || !masked || length > maxFrameBytes) socket.end(closeFrame()); return buffer.subarray(cursor); }
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

export function createSignalingServer(options = {}) {
  const config = normalizeServiceOptions(options); if (!config.secret) throw new TypeError('secret is required');
  const broker = createSignalingBroker({secret: config.secret, ...(options.brokerOptions || {})}); const sockets = new Set(); let rejectedConnections = 0;
  const server = createServer(async (request, response) => {
    if (request.url === '/health') return json(response, 200, {service: 'spartan-signaling-reference', version: 1, ...broker.stats(), limits: {maxConnections: config.maxConnections, maxMessagesPerSecond: config.maxMessagesPerSecond}, connections: sockets.size, rejectedConnections});
    if (!request.url?.startsWith('/admin/')) return json(response, 404, {error: 'not found'});
    if (!config.adminSecret || !adminAuthorized(request, config.adminSecret)) return json(response, 401, {error: 'admin authorization required'});
    if (request.url === '/admin/health' && request.method === 'GET') return json(response, 200, {service: 'spartan-signaling-reference', version: 1, ...broker.stats(), limits: {maxConnections: config.maxConnections, maxMessagesPerSecond: config.maxMessagesPerSecond}, connections: sockets.size, rejectedConnections});
    if (request.url === '/admin/tickets' && request.method === 'POST') {
      try {
        const body = JSON.parse(await readBody(request));
        const sessionId = text(body.sessionId); const role = text(body.role); const subject = text(body.subject || role); const ttlMs = body.ttlMs === undefined ? undefined : Number(body.ttlMs);
        const ticket = broker.issueTicket({sessionId, role, subject, ...(ttlMs === undefined ? {} : {ttlMs})});
        return json(response, 201, {version: 1, sessionId, role, subject, ttlMs: ttlMs ?? 10 * 60 * 1000, ticket});
      } catch (error) { return json(response, 400, {error: error instanceof Error ? error.message : String(error)}); }
    }
    response.setHeader('allow', 'GET, POST'); return json(response, 405, {error: 'method or admin route not allowed'});
  });
  server.on('upgrade', (request, socket) => {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (!isOriginAllowed(request.headers.origin, config.allowedOrigins)) { rejectedConnections += 1; reject(socket, '403 Forbidden'); return; }
    if (sockets.size >= config.maxConnections) { rejectedConnections += 1; reject(socket, '503 Service Unavailable'); return; }
    if (url.pathname !== '/signal' || request.headers.upgrade?.toLowerCase() !== 'websocket' || request.headers['sec-websocket-version'] !== '13' || !request.headers['sec-websocket-key']) { rejectedConnections += 1; reject(socket); return; }
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: WebSocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${acceptKey(request.headers['sec-websocket-key'])}\r\n\r\n`);
    sockets.add(socket); let buffer = Buffer.alloc(0); let participant; let detached = false; const limiter = createMessageRateLimiter({limit: config.maxMessagesPerSecond});
    const cleanup = () => { if (detached) return; detached = true; sockets.delete(socket); participant?.detach(); };
    const fail = () => { cleanup(); socket.end(closeFrame()); };
    socket.on('data', chunk => {
      if (buffer.length + chunk.length > config.maxFrameBytes * 2) { fail(); return; }
      buffer = parseFrames(Buffer.concat([buffer, chunk]), textValue => {
        if (!limiter.take()) { fail(); return; }
        try {
          const message = JSON.parse(textValue);
          if (!participant) { if (message?.type !== 'signaling.join') throw new Error('signaling join required'); participant = broker.attach({sessionId: message.sessionId, role: message.role, ticket: message.ticket, send: value => socket.write(frame(JSON.stringify(value), config.maxFrameBytes))}); }
          else participant.send(message);
        } catch { fail(); }
      }, socket, config.maxFrameBytes);
    });
    socket.on('close', cleanup); socket.on('error', cleanup);
  });
  return Object.freeze({config, broker, server, stats: () => Object.freeze({connections: sockets.size, rejectedConnections, ...broker.stats()}), start() { return new Promise((resolve, rejectStart) => { server.once('error', rejectStart); server.listen(config.port, config.bind, () => { server.removeListener('error', rejectStart); resolve(server.address()); }); }); }, close() { for (const socket of sockets) socket.destroy(); server.closeIdleConnections?.(); server.closeAllConnections?.(); if (!server.listening) return Promise.resolve(); return new Promise(resolve => server.close(() => resolve())); }});
}

if (pathEqualsMain()) {
  try {
    const args = parseArguments(process.argv.slice(2)); const allowedOrigins = String(args.get('allowed-origins') || process.env.SPARTAN_SIGNALING_ALLOWED_ORIGINS || '').split(',').map(text).filter(Boolean);
    const service = createSignalingServer({secret: args.get('secret') || process.env.SPARTAN_SIGNALING_SECRET, adminSecret: args.get('admin-secret') || process.env.SPARTAN_SIGNALING_ADMIN_SECRET, bind: args.get('bind') || process.env.SPARTAN_SIGNALING_BIND, port: args.get('port') || process.env.SPARTAN_SIGNALING_PORT, allowedOrigins, maxConnections: args.get('max-connections') || process.env.SPARTAN_SIGNALING_MAX_CONNECTIONS, maxMessagesPerSecond: args.get('max-messages-per-second') || process.env.SPARTAN_SIGNALING_MAX_MESSAGES_PER_SECOND});
    service.start().then(address => console.log(JSON.stringify({service: 'spartan-signaling-reference', endpoint: `ws://${address.address === '0.0.0.0' ? '127.0.0.1' : address.address}:${address.port}/signal`, health: `http://${address.address === '0.0.0.0' ? '127.0.0.1' : address.address}:${address.port}/health`, allowedOrigins: service.config.allowedOrigins, limits: {maxConnections: service.config.maxConnections, maxMessagesPerSecond: service.config.maxMessagesPerSecond}, warning: 'Reference signaling only; use TLS, secret management, clustered session storage, and separately provisioned STUN/TURN in production.'}))).catch(error => { console.error(error.message); process.exitCode = 1; });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

function pathEqualsMain() { return path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || ''); }
