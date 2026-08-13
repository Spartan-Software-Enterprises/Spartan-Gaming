import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import test from 'node:test';
import {createAppHostServer} from './app-host.mjs';

const repositoryRoot = resolve(import.meta.dirname, '..');
const frontendRoot = resolve(repositoryRoot, 'src/frontend');

function acceptKey(key) { return createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64'); }
function frame(text) { const body = Buffer.from(text); const size = body.length; if (size < 126) return Buffer.concat([Buffer.from([0x81, size]), body]); const header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(size, 2); return Buffer.concat([header, body]); }
function maskedFrame(text) { const body = Buffer.from(text); const mask = Buffer.from([1, 2, 3, 4]); const masked = Buffer.from(body); for (let index = 0; index < masked.length; index += 1) masked[index] ^= mask[index % 4]; const size = body.length; const header = Buffer.alloc(6); header[0] = 0x81; header[1] = 0x80 | size; mask.copy(header, 2); return Buffer.concat([header, masked]); }
function unmaskPayload(chunk) { if (chunk.length < 6) return chunk.toString('utf8'); const mask = chunk.subarray(2, 6); const payload = Buffer.from(chunk.subarray(6)); for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4]; return payload.toString('utf8'); }

function startEchoAgent() {
  const server = createServer((request, response) => {
    if (request.url === '/health') { response.writeHead(200, {'content-type': 'application/json'}); response.end(JSON.stringify({service: 'spartan-host-reference', version: 1, hostName: 'Echo Agent'})); return; }
    response.writeHead(404); response.end();
  });
  const sessions = new Set();
  const sockets = new Set();
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  server.on('upgrade', (request, socket) => {
    sockets.add(socket);
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${acceptKey(request.headers['sec-websocket-key'])}\r\n\r\n`);
    sessions.add(socket);
    socket.on('data', chunk => { socket.write(frame(`echo:${unmaskPayload(chunk)}`)); });
    socket.on('close', () => sessions.delete(socket));
  });
  return {
    server,
    listen() { return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port))); },
    close() { return new Promise(resolve => { for (const socket of sockets) socket.destroy(); server.close(() => resolve()); }); },
    count() { return sessions.size; },
  };
}

test('app host serves the bundled frontend with an injected context script and health', async () => {
  const appHost = createAppHostServer({port: 0, root: frontendRoot, logger: {warn() {}}, contextScript: {path: 'spartan-context.js', render: () => 'window.__SPARTAN_RELEASE_FEED__ = {schemaVersion: 1, records: []};'}});
  const address = await appHost.listen();
  try {
    const origin = `http://127.0.0.1:${address.port}`;
    const rootResponse = await fetch(origin, {redirect: 'manual'});
    assert.equal(rootResponse.status, 302);
    assert.equal(rootResponse.headers.get('location'), '/dashboard/?startup=1');
    const page = await fetch(`${origin}/dashboard/`);
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /<script src="\/spartan-context\.js"><\/script>/);
    const context = await fetch(`${origin}/spartan-context.js`);
    assert.equal(context.status, 200);
    assert.match(await context.text(), /__SPARTAN_RELEASE_FEED__/);
    const health = await fetch(`${origin}/health`);
    assert.equal(health.status, 200);
    const body = await health.json();
    assert.equal(body.service, 'spartan-app-host');
    assert.equal(body.activeSessions, 0);
    assert.equal(body.agent, null);
  } finally { await appHost.close(); }
});

test('app host proxies /session upgrades to an embedded agent and reports its health', async () => {
  const agent = startEchoAgent();
  const agentPort = await agent.listen();
  try {
    const appHost = createAppHostServer({port: 0, root: frontendRoot, logger: {warn() {}}, agentEndpoint: `ws://127.0.0.1:${agentPort}/session`});
    const address = await appHost.listen();
    try {
      const origin = `http://127.0.0.1:${address.port}`;
      const health = await (await fetch(`${origin}/health`)).json();
      assert.equal(health.agent.hostName, 'Echo Agent');

      const ws = new WebSocket(`ws://127.0.0.1:${address.port}/session`);
      const opened = new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
      await opened;
      const reply = new Promise((resolve, reject) => { ws.onmessage = event => resolve(event.data); ws.onerror = reject; });
      ws.send('ping');
      const echoed = await reply;
      assert.equal(echoed, 'echo:ping');
      ws.close();
    } finally { await appHost.close(); }
  } finally { await agent.close(); }
});
