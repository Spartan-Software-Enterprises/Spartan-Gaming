import {createServer, request as httpRequest} from 'node:http';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createAssetResolver, sendFile} from '../scripts/frontend/serve.mjs';
import {resolveAdapterHome} from './adapter-home.mjs';

function required(value, name) { if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`); return value.trim(); }

/** Transparent byte proxy: forward the client's upgrade handshake to the agent and pipe both sockets. */
export function createWebSocketProxy({endpoint, onOpen = () => {}, onClose = () => {}} = {}) {
  const target = new URL(required(endpoint, 'endpoint'));
  if (!['ws:', 'wss:'].includes(target.protocol)) throw new TypeError('endpoint must use the ws: or wss: scheme');
  const upstreamSockets = new Set();
  const handshake = (request, socket, head) => {
    const upstream = new URL(request.url || '/', `http://${target.host}`);
    const baseHeaders = {host: target.host, 'upgrade': 'websocket', 'connection': 'Upgrade', 'sec-websocket-key': request.headers['sec-websocket-key'] || '', 'sec-websocket-version': request.headers['sec-websocket-version'] || '13'};
    if (request.headers.origin) baseHeaders.origin = request.headers.origin;
    const client = httpRequest({host: target.hostname, port: Number(target.port || 80), method: 'GET', path: upstream.pathname + upstream.search, headers: baseHeaders}, response => { response.resume(); socket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n'); });
    client.on('upgrade', (response, upstreamSocket) => {
      if (!response.headers.upgrade || String(response.headers.upgrade).toLowerCase() !== 'websocket') { upstreamSocket.destroy(); socket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n'); return; }
      upstreamSockets.add(upstreamSocket);
      socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${response.headers['sec-websocket-accept'] || ''}\r\n\r\n`);
      if (head && head.length) upstreamSocket.write(head);
      const session = {accepted: true, closed: false};
      onOpen(session);
      const cleanup = () => { if (session.closed) return; session.closed = true; socket.destroy(); upstreamSocket.destroy(); upstreamSockets.delete(upstreamSocket); onClose(session); };
      socket.on('error', cleanup); upstreamSocket.on('error', cleanup);
      socket.on('close', cleanup); upstreamSocket.on('close', cleanup);
      socket.pipe(upstreamSocket); upstreamSocket.pipe(socket);
    });
    client.on('error', () => { socket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n'); });
    client.end();
  };
  return Object.freeze({target, handshake, close() { for (const socket of upstreamSockets) socket.destroy(); upstreamSockets.clear(); }});
}

export async function fetchHealth(target) {
  const protocol = target.protocol === 'wss:' ? 'https' : 'http';
  const response = await fetch(`${protocol}://${target.host}/health`);
  if (!response.ok) throw new Error(`agent health failed: ${response.status}`);
  return response.json();
}

/**
 * One loopback origin for the whole desktop app: bundled frontend, injected
 * app context, /health, and /session forwarded to the embedded host agent.
 */
export function createAppHostServer({host = '127.0.0.1', port = 4173, root, publicRoot, contextScript = null, agentEndpoint = null, adapterHome = resolveAdapterHome(), logger = console, assets = null} = {}) {
  const frontendRoot = resolve(root || process.cwd());
  const publicDirectory = resolve(publicRoot || frontendRoot);
  const runtimeRoot = resolve(fileURLToPath(import.meta.url), '..');
  const resolveAsset = assets || createAssetResolver({root: frontendRoot, publicRoot: publicDirectory, runtimeRoot});
  if (contextScript && (!contextScript.path || typeof contextScript.render !== 'function')) throw new TypeError('contextScript must provide a path and a render() function');
  const proxy = agentEndpoint ? createWebSocketProxy({endpoint: agentEndpoint}) : null;
  const sessions = new Set();
  const sockets = new Set();
  const server = createServer(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405, {'allow': 'GET, HEAD'}); response.end('Method Not Allowed'); return; }
    const url = new URL(request.url || '/', `http://${request.headers.host || `${host}:${port}`}`);
    if (url.pathname === '/health') {
      let agent = null;
      if (proxy) { try { agent = await fetchHealth(proxy.target); } catch { agent = {error: 'agent unreachable'}; } }
      response.writeHead(200, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'});
      response.end(JSON.stringify({service: 'spartan-app-host', version: 1, host, adapterHome, agentEndpoint: agentEndpoint || null, activeSessions: sessions.size, agent, time: Date.now()}));
      return;
    }
    if (url.pathname === '/session') { response.writeHead(404); response.end('use a WebSocket upgrade to connect to /session'); return; }
    if (contextScript && url.pathname === `/${contextScript.path}`) {
      const body = Buffer.from(contextScript.render());
      response.writeHead(200, {'cache-control': 'no-store', connection: 'close', 'content-length': body.length, 'content-type': 'text/javascript; charset=utf-8', 'content-security-policy': "script-src 'self'", 'x-content-type-options': 'nosniff'});
      response.end(body); return;
    }
    if (url.pathname === '/') { response.writeHead(302, {'location': '/dashboard/?startup=1'}); response.end(); return; }
    if (url.pathname === '/dashboard') { response.writeHead(301, {'location': '/dashboard/'}); response.end(); return; }
    const resolved = resolveAsset(url.pathname);
    if (resolved.status) { response.writeHead(resolved.status); response.end(resolved.status === 404 ? 'Not Found' : 'Bad Request'); return; }
    if (!resolved.file || !(await sendFile(response, resolved.file, request.method, contextScript))) { response.writeHead(404); response.end('Not Found'); return; }
  });
  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || `${host}:${port}`}`);
    if (url.pathname !== '/session' || !proxy) { socket.end('HTTP/1.1 404 Not Found\r\n\r\n'); return; }
    proxy.handshake(request, socket, head);
  });
  server.on('clientError', (error, socket) => { logger.warn?.(`app host client error: ${error.message}`); socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); });
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  return {
    server,
    listen() { return new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, () => resolve(server.address())); }); },
    close() { return new Promise(resolve => { proxy?.close(); for (const socket of sockets) socket.destroy(); server.close(() => resolve()); }); },
  };
}

function readArgument(name, fallback) { const index = process.argv.indexOf(`--${name}`); return index < 0 ? fallback : process.argv[index + 1]; }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const host = String(readArgument('host', '127.0.0.1'));
  const port = Number(readArgument('port', 4173));
  const root = resolve(readArgument('root', process.cwd()));
  const publicRoot = resolve(readArgument('public-root', resolve(root, 'public')));
  const agentEndpoint = readArgument('agent-endpoint', null);
  const adapterHome = readArgument('adapter-home', resolveAdapterHome());
  const seedRoot = readArgument('seed-root', null);
  const platform = String(readArgument('platform', process.platform));
  const contextScript = await (async () => {
    if (!seedRoot) return null;
    const {createSeedContextScript, runSeedInstall} = await import('./adapter-seed.mjs');
    try { await runSeedInstall({seedRoot, installRoot: adapterHome, platform, apply: true}); } catch (error) { console.error(`seed install skipped: ${error.message}`); }
    return createSeedContextScript({seedRoot, platform});
  })();
  const appHost = createAppHostServer({host, port, root, publicRoot, contextScript, agentEndpoint, adapterHome});
  appHost.listen().then(address => console.log(JSON.stringify({service: 'spartan-app-host', url: `http://${address.address === '::' ? `[${address.address}]` : address.address}:${address.port}/dashboard/?startup=1`, host: address.address, port: address.port, agentEndpoint: agentEndpoint || null, seedRoot: seedRoot || null}))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
