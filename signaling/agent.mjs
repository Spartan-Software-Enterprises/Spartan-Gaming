#!/usr/bin/env node
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSignalingBroker } from './broker.mjs';
import { resolveConfiguredSecret, resolveProductionConfig } from './production-config.mjs';

const DEFAULT_MAX_FRAME_BYTES = 64 * 1024;
const DEFAULT_MAX_CONNECTIONS = 256;
const DEFAULT_MAX_MESSAGES_PER_SECOND = 120;
const SHUTDOWN_TIMEOUT_MS = 2000;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}
function enrollmentEndpoint(value) {
  const raw = text(value);
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new TypeError('host enrollment endpoint must be a valid URL');
  }
  if (!['ws:', 'wss:'].includes(url.protocol) || url.username || url.password || url.hash)
    throw new TypeError('host enrollment endpoint must be credential-free ws/wss URL');
  if (
    url.protocol === 'ws:' &&
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
    !url.hostname.endsWith('.local')
  )
    throw new TypeError('remote host enrollment endpoint must use wss');
  return url.toString();
}
function positiveInteger(value, fallback, maximum) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? Math.min(number, maximum) : fallback;
}
function portNumber(value, fallback = 8790) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 65535 ? number : fallback;
}

export function normalizeServiceOptions(options = {}) {
  const allowedOrigins = Array.isArray(options.allowedOrigins)
    ? [...new Set(options.allowedOrigins.map(text).filter(Boolean))]
    : [];
  const tlsKey = text(options.tlsKey);
  const tlsCert = text(options.tlsCert);
  if (Boolean(tlsKey) !== Boolean(tlsCert))
    throw new TypeError('tlsKey and tlsCert must be provided together');
  return Object.freeze({
    secret: text(options.secret),
    bind: text(options.bind) || '127.0.0.1',
    port: portNumber(options.port),
    adminSecret: text(options.adminSecret),
    allowedOrigins: Object.freeze(allowedOrigins),
    maxConnections: positiveInteger(options.maxConnections, DEFAULT_MAX_CONNECTIONS, 10000),
    maxMessagesPerSecond: positiveInteger(
      options.maxMessagesPerSecond,
      DEFAULT_MAX_MESSAGES_PER_SECOND,
      10000,
    ),
    maxFrameBytes: positiveInteger(
      options.maxFrameBytes,
      DEFAULT_MAX_FRAME_BYTES,
      DEFAULT_MAX_FRAME_BYTES,
    ),
    turnSecret: text(options.turnSecret),
    turnUrls: Object.freeze(
      Array.isArray(options.turnUrls)
        ? [...new Set(options.turnUrls.map(text).filter(Boolean))]
        : [],
    ),
    tls: Object.freeze({
      enabled: Boolean(tlsKey),
      keyPath: tlsKey || null,
      certPath: tlsCert || null,
    }),
  });
}

export function isOriginAllowed(origin, allowedOrigins = []) {
  return !allowedOrigins.length || (typeof origin === 'string' && allowedOrigins.includes(origin));
}

export function createMessageRateLimiter({
  limit = DEFAULT_MAX_MESSAGES_PER_SECOND,
  windowMs = 1000,
  clock = () => Date.now(),
} = {}) {
  let startedAt = clock();
  let count = 0;
  return Object.freeze({
    take() {
      const now = clock();
      if (now - startedAt >= windowMs) {
        startedAt = now;
        count = 0;
      }
      count += 1;
      return count <= limit;
    },
  });
}

export function createTurnCredentials({
  secret,
  subject = 'spartan-client',
  ttlSeconds = 3600,
  clock = () => Date.now(),
} = {}) {
  const signingSecret = text(secret);
  if (signingSecret.length < 32)
    throw new TypeError('TURN shared secret must contain at least 32 characters');
  const safeSubject =
    text(subject)
      .replace(/[^A-Za-z0-9._:-]/g, '-')
      .slice(0, 64) || 'spartan-client';
  const ttl = Number(ttlSeconds);
  if (!Number.isInteger(ttl) || ttl < 60 || ttl > 24 * 60 * 60)
    throw new RangeError('TURN credential TTL is out of bounds');
  const expiresAt = Math.floor(clock() / 1000) + ttl;
  const username = `${expiresAt}:${safeSubject}`;
  return Object.freeze({
    username,
    credential: createHmac('sha1', signingSecret).update(username).digest('base64'),
    ttlSeconds: ttl,
  });
}

function parseArguments(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value?.startsWith('--')) continue;
    args.set(value.slice(2), argv[index + 1]?.startsWith('--') ? true : argv[++index]);
  }
  return args;
}

export function resolveSignalingSecrets({ args = new Map(), env = process.env, readFile } = {}) {
  return Object.freeze({
    secret:
      args.get('secret') ||
      resolveConfiguredSecret({
        env,
        name: 'SPARTAN_SIGNALING_SECRET',
        ...(readFile ? { readFile } : {}),
      }),
    adminSecret:
      args.get('admin-secret') ||
      resolveConfiguredSecret({
        env,
        name: 'SPARTAN_SIGNALING_ADMIN_SECRET',
        ...(readFile ? { readFile } : {}),
      }),
  });
}

function frame(textValue, maxFrameBytes = DEFAULT_MAX_FRAME_BYTES) {
  const body = Buffer.from(textValue);
  if (body.length > maxFrameBytes) throw new Error('WebSocket message is too large');
  if (body.length < 126) return Buffer.concat([Buffer.from([0x81, body.length]), body]);
  const header = Buffer.alloc(4);
  header[0] = 0x81;
  header[1] = 126;
  header.writeUInt16BE(body.length, 2);
  return Buffer.concat([header, body]);
}
function closeFrame() {
  return Buffer.from([0x88, 0x00]);
}
function acceptKey(key) {
  return createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
}
function reject(socket, status = '400 Bad Request') {
  socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}
function json(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(body));
}
export async function readBrokerHealth(broker) {
  if (typeof broker?.health !== 'function') return Object.freeze({ status: 'not-reported' });
  try {
    const result = await broker.health();
    const status = ['ready', 'degraded', 'unavailable'].includes(result?.status)
      ? result.status
      : 'unknown';
    const backend = text(result?.backend).slice(0, 80) || null;
    return Object.freeze({ status, ...(backend ? { backend } : {}) });
  } catch {
    return Object.freeze({ status: 'unavailable' });
  }
}
function adminAuthorized(request, secret) {
  if (!secret) return false;
  const value = request.headers.authorization || '';
  const token = value.startsWith('Bearer ') ? value.slice(7) : '';
  const expected = Buffer.from(secret);
  const actual = Buffer.from(token);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
function readBody(request, maximum = 4096) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > maximum) {
        fail(new Error('request body is too large'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (!settled) {
        settled = true;
        resolve(Buffer.concat(chunks).toString('utf8'));
      }
    });
    request.on('error', fail);
  });
}

export function parseFrames(
  buffer,
  onMessage,
  socket,
  maxFrameBytes = DEFAULT_MAX_FRAME_BYTES,
  onPing,
) {
  let cursor = 0;
  while (buffer.length - cursor >= 2) {
    const first = buffer[cursor];
    const second = buffer[cursor + 1];
    const opcode = first & 0x0f;
    const masked = Boolean(second & 0x80);
    let length = second & 0x7f;
    let header = 2;
    if (length === 126) {
      if (buffer.length - cursor < 4) break;
      length = buffer.readUInt16BE(cursor + 2);
      header = 4;
    }
    if (
      length === 127 ||
      !masked ||
      length > maxFrameBytes ||
      buffer.length - cursor < header + 4 + length
    ) {
      if (length === 127 || !masked || length > maxFrameBytes) socket.end(closeFrame());
      return buffer.subarray(cursor);
    }
    const mask = buffer.subarray(cursor + header, cursor + header + 4);
    const payload = Buffer.from(buffer.subarray(cursor + header + 4, cursor + header + 4 + length));
    for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4];
    cursor += header + 4 + length;
    if (opcode === 0x8) {
      socket.end(closeFrame());
      return buffer.subarray(cursor);
    }
    if (opcode === 0x9) {
      if (onPing && !onPing()) {
        socket.end(closeFrame());
        return buffer.subarray(cursor);
      }
      socket.write(Buffer.from([0x8a, 0]));
      continue;
    }
    if (opcode !== 0x1) {
      socket.end(closeFrame());
      return Buffer.alloc(0);
    }
    onMessage(payload.toString('utf8'));
  }
  return buffer.subarray(cursor);
}

export function createSignalingServer(options = {}) {
  const config = normalizeServiceOptions(options);
  if (!config.secret && !options.broker)
    throw new TypeError('secret is required when no broker is supplied');
  const broker =
    options.broker ||
    createSignalingBroker({ secret: config.secret, ...(options.brokerOptions || {}) });
  if (
    !broker ||
    typeof broker.attach !== 'function' ||
    typeof broker.issueTicket !== 'function' ||
    typeof broker.stats !== 'function'
  )
    throw new TypeError('broker must implement attach, issueTicket, and stats');
  const sockets = new Set();
  let rejectedConnections = 0;
  const requestHandler = async (request, response) => {
    if (request.url === '/health')
      return json(response, 200, {
        service: 'spartan-signaling-reference',
        version: 1,
        ...broker.stats(),
        broker: await readBrokerHealth(broker),
        secure: config.tls.enabled,
        limits: {
          maxConnections: config.maxConnections,
          maxMessagesPerSecond: config.maxMessagesPerSecond,
        },
        connections: sockets.size,
        rejectedConnections,
      });
    if (!request.url?.startsWith('/admin/')) return json(response, 404, { error: 'not found' });
    if (!config.adminSecret || !adminAuthorized(request, config.adminSecret))
      return json(response, 401, { error: 'admin authorization required' });
    if (request.url === '/admin/health' && request.method === 'GET')
      return json(response, 200, {
        service: 'spartan-signaling-reference',
        version: 1,
        ...broker.stats(),
        broker: await readBrokerHealth(broker),
        secure: config.tls.enabled,
        limits: {
          maxConnections: config.maxConnections,
          maxMessagesPerSecond: config.maxMessagesPerSecond,
        },
        connections: sockets.size,
        rejectedConnections,
      });
    if (request.url === '/admin/tickets' && request.method === 'POST') {
      try {
        const body = JSON.parse(await readBody(request));
        const sessionId = text(body.sessionId);
        const role = text(body.role);
        const subject = text(body.subject || role);
        const ttlMs = body.ttlMs === undefined ? undefined : Number(body.ttlMs);
        const ticket = broker.issueTicket({
          sessionId,
          role,
          subject,
          ...(ttlMs === undefined ? {} : { ttlMs }),
        });
        return json(response, 201, {
          version: 1,
          sessionId,
          role,
          subject,
          ttlMs: ttlMs ?? 10 * 60 * 1000,
          ticket,
        });
      } catch (error) {
        return json(response, 400, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if (request.url === '/admin/host-enrollment' && request.method === 'POST') {
      try {
        const body = JSON.parse(await readBody(request));
        const endpoint = enrollmentEndpoint(body.endpoint);
        const sessionId = text(body.sessionId);
        const subject = text(body.subject || 'spartan-host');
        const ttlMs = body.ttlMs === undefined ? undefined : Number(body.ttlMs);
        const ticket = broker.issueTicket({
          sessionId,
          role: 'host',
          subject,
          ...(ttlMs === undefined ? {} : { ttlMs }),
        });
        return json(response, 201, {
          version: 1,
          endpoint,
          sessionId,
          role: 'host',
          subject,
          ttlMs: ttlMs ?? 10 * 60 * 1000,
          ticket,
        });
      } catch (error) {
        return json(response, 400, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if (request.url === '/admin/turn-credentials' && request.method === 'POST') {
      if (!config.turnSecret)
        return json(response, 503, { error: 'TURN credential service is not configured' });
      try {
        const body = JSON.parse(await readBody(request));
        const credentials = createTurnCredentials({
          secret: config.turnSecret,
          subject: body.subject,
          ttlSeconds: body.ttlSeconds,
        });
        return json(response, 201, { version: 1, ...credentials, urls: config.turnUrls });
      } catch (error) {
        return json(response, 400, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    response.setHeader('allow', 'GET, POST');
    return json(response, 405, { error: 'method or admin route not allowed' });
  };
  const server = config.tls.enabled
    ? createHttpsServer(
        { key: readFileSync(config.tls.keyPath), cert: readFileSync(config.tls.certPath) },
        requestHandler,
      )
    : createHttpServer(requestHandler);
  server.on('upgrade', (request, socket) => {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (!isOriginAllowed(request.headers.origin, config.allowedOrigins)) {
      rejectedConnections += 1;
      reject(socket, '403 Forbidden');
      return;
    }
    if (sockets.size >= config.maxConnections) {
      rejectedConnections += 1;
      reject(socket, '503 Service Unavailable');
      return;
    }
    if (
      url.pathname !== '/signal' ||
      request.headers.upgrade?.toLowerCase() !== 'websocket' ||
      request.headers['sec-websocket-version'] !== '13' ||
      !request.headers['sec-websocket-key']
    ) {
      rejectedConnections += 1;
      reject(socket);
      return;
    }
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\nUpgrade: WebSocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${acceptKey(request.headers['sec-websocket-key'])}\r\n\r\n`,
    );
    sockets.add(socket);
    let buffer = Buffer.alloc(0);
    let participant;
    let joining;
    const pending = [];
    let detached = false;
    const limiter = createMessageRateLimiter({ limit: config.maxMessagesPerSecond });
    const cleanup = () => {
      if (detached) return;
      detached = true;
      sockets.delete(socket);
      participant?.detach();
    };
    const fail = () => {
      cleanup();
      socket.end(closeFrame());
    };
    socket.on('data', (chunk) => {
      if (buffer.length + chunk.length > config.maxFrameBytes * 2) {
        fail();
        return;
      }
      buffer = parseFrames(
        Buffer.concat([buffer, chunk]),
        (textValue) => {
          if (!limiter.take()) {
            fail();
            return;
          }
          try {
            const message = JSON.parse(textValue);
            if (!participant) {
              if (message?.type !== 'signaling.join') {
                if (joining) pending.push(message);
                else throw new Error('signaling join required');
              } else if (joining) throw new Error('duplicate signaling join');
              else {
                joining = Promise.resolve(
                  broker.attach({
                    sessionId: message.sessionId,
                    role: message.role,
                    ticket: message.ticket,
                    send: (value) =>
                      socket.write(frame(JSON.stringify(value), config.maxFrameBytes)),
                  }),
                )
                  .then((value) => {
                    if (detached) return value.detach?.();
                    participant = value;
                    return Promise.all(pending.splice(0).map((item) => participant.send(item)));
                  })
                  .catch(fail);
              }
            } else Promise.resolve(participant.send(message)).catch(fail);
          } catch {
            fail();
          }
        },
        socket,
        config.maxFrameBytes,
        () => limiter.take(),
      );
    });
    socket.on('close', cleanup);
    socket.on('error', cleanup);
  });
  return Object.freeze({
    config,
    broker,
    server,
    stats: () =>
      Object.freeze({ connections: sockets.size, rejectedConnections, ...broker.stats() }),
    start() {
      return new Promise((resolve, rejectStart) => {
        server.once('error', rejectStart);
        server.listen(config.port, config.bind, () => {
          server.removeListener('error', rejectStart);
          resolve(server.address());
        });
      });
    },
    async close() {
      for (const socket of sockets) socket.destroy();
      server.closeIdleConnections?.();
      server.closeAllConnections?.();
      if (server.listening)
        await new Promise((resolve) => {
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            resolve();
          };
          server.close(finish);
          const timeout = setTimeout(finish, SHUTDOWN_TIMEOUT_MS);
          timeout.unref?.();
        });
      await broker.close?.();
    },
  });
}

export async function loadBrokerAdapter({
  packageName,
  loader = (name) => import(name),
  options = {},
} = {}) {
  if (typeof packageName !== 'string' || !packageName.trim())
    throw new TypeError('broker package name is required');
  if (typeof loader !== 'function') throw new TypeError('broker loader must be a function');
  let module;
  try {
    module = await loader(packageName.trim());
  } catch {
    throw new Error('signaling broker package failed to load');
  }
  if (typeof module?.createBroker !== 'function')
    throw new Error('signaling broker package must export createBroker');
  let broker;
  try {
    broker = await module.createBroker(options);
  } catch {
    throw new Error('signaling broker package initialization failed');
  }
  if (
    !broker ||
    typeof broker.attach !== 'function' ||
    typeof broker.issueTicket !== 'function' ||
    typeof broker.stats !== 'function'
  )
    throw new Error('signaling broker package returned an invalid broker');
  return broker;
}

if (pathEqualsMain()) {
  try {
    const productionConfig =
      process.env.NODE_ENV === 'production' ? resolveProductionConfig() : null;
    const args = parseArguments(process.argv.slice(2));
    const allowedOrigins = String(
      args.get('allowed-origins') || process.env.SPARTAN_SIGNALING_ALLOWED_ORIGINS || '',
    )
      .split(',')
      .map(text)
      .filter(Boolean);
    const brokerPackage = text(
      args.get('broker-package') || process.env.SPARTAN_SIGNALING_BROKER_PACKAGE,
    );
    const { secret, adminSecret } = resolveSignalingSecrets({ args });
    const turnSecret = resolveConfiguredSecret({
      env: process.env,
      name: 'SPARTAN_SIGNALING_TURN_SECRET',
    });
    const broker = brokerPackage
      ? await loadBrokerAdapter({
          packageName: brokerPackage,
          options: { environment: process.env, secret },
        })
      : undefined;
    const service = createSignalingServer({
      ...(broker ? { broker } : {}),
      secret,
      adminSecret,
      turnSecret,
      turnUrls:
        productionConfig?.turnUrls ||
        String(process.env.SPARTAN_SIGNALING_TURN_URLS || '')
          .split(',')
          .map(text)
          .filter(Boolean),
      bind: args.get('bind') || process.env.SPARTAN_SIGNALING_BIND,
      port: args.get('port') || process.env.SPARTAN_SIGNALING_PORT,
      allowedOrigins,
      maxConnections: args.get('max-connections') || process.env.SPARTAN_SIGNALING_MAX_CONNECTIONS,
      maxMessagesPerSecond:
        args.get('max-messages-per-second') ||
        process.env.SPARTAN_SIGNALING_MAX_MESSAGES_PER_SECOND,
      tlsKey: args.get('tls-key') || process.env.SPARTAN_SIGNALING_TLS_KEY,
      tlsCert: args.get('tls-cert') || process.env.SPARTAN_SIGNALING_TLS_CERT,
    });
    service
      .start()
      .then((address) => {
        const host = address.address === '0.0.0.0' ? '127.0.0.1' : address.address;
        const protocol = service.config.tls.enabled ? 'wss' : 'ws';
        const httpProtocol = service.config.tls.enabled ? 'https' : 'http';
        console.log(
          JSON.stringify({
            service: 'spartan-signaling-reference',
            endpoint: `${protocol}://${host}:${address.port}/signal`,
            health: `${httpProtocol}://${host}:${address.port}/health`,
            secure: service.config.tls.enabled,
            allowedOrigins: service.config.allowedOrigins,
            limits: {
              maxConnections: service.config.maxConnections,
              maxMessagesPerSecond: service.config.maxMessagesPerSecond,
            },
            warning:
              'Reference signaling only; use secret management, clustered session storage, and separately provisioned STUN/TURN in production.',
          }),
        );
      })
      .catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
      });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

function pathEqualsMain() {
  return path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || '');
}
