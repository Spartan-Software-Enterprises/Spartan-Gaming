#!/usr/bin/env node
import { createReadStream, existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const frontendRoot = path.join(repositoryRoot, 'src/frontend');
const MIME_TYPES = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
});

function safePath(root, pathname) {
  const candidate = path.resolve(root, `.${pathname}`);
  const relative = path.relative(root, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return candidate;
}

function decodePath(pathname) {
  try {
    const decoded = decodeURIComponent(pathname);
    if (decoded.includes('\0') || !decoded.startsWith('/')) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function createAssetResolver({
  root = frontendRoot,
  publicRoot = repositoryRoot,
  runtimeRoot = null,
} = {}) {
  const mounts = Object.freeze([
    Object.freeze({ urlPrefix: '/src/frontend', root }),
    Object.freeze({ urlPrefix: '/providers', root: path.join(publicRoot, 'providers') }),
    Object.freeze({ urlPrefix: '/emulators', root: path.join(publicRoot, 'emulators') }),
    Object.freeze({ urlPrefix: '/games', root: path.join(publicRoot, 'games') }),
  ]);
  return (pathname) => {
    const decoded = decodePath(pathname);
    if (!decoded) return { status: 400 };
    if (decoded === '/catalogs/providers.json')
      return { file: path.join(publicRoot, 'providers/catalog.json') };
    if (decoded === '/catalogs/emulators.json')
      return { file: path.join(publicRoot, 'emulators/catalog.json') };
    if (decoded === '/catalogs/games.json')
      return { file: path.join(publicRoot, 'games/catalog.json') };
    if (decoded === '/service-worker.mjs') return { file: path.join(root, 'service-worker.mjs') };
    if (decoded.startsWith('/pwa/'))
      return { file: safePath(path.join(root, 'pwa'), decoded.slice('/pwa'.length)) };
    for (const mount of mounts) {
      if (mount.urlPrefix !== '/src/frontend' && !decoded.endsWith('.json')) continue;
      if (decoded === mount.urlPrefix || decoded.startsWith(`${mount.urlPrefix}/`)) {
        return { file: safePath(mount.root, decoded.slice(mount.urlPrefix.length) || '/') };
      }
    }
    if (runtimeRoot && decoded.startsWith('/host/')) {
      const frontendHostFile = safePath(root, decoded);
      if (!frontendHostFile || !existsSync(frontendHostFile))
        return { file: safePath(runtimeRoot, decoded.slice('/host'.length)) };
    }
    if (decoded.endsWith('.mjs') || decoded.endsWith('.js')) {
      const frontendFile = safePath(root, decoded);
      if (frontendFile && existsSync(frontendFile)) return { file: frontendFile };
      return { file: safePath(publicRoot, decoded) };
    }
    const firstSegment = decoded.split('/')[1];
    if (
      firstSegment &&
      [
        'adapters',
        'capture',
        'compatibility',
        'dashboard',
        'diagnostics',
        'display',
        'emulation',
        'host',
        'input',
        'launch',
        'platform',
        'player',
        'privacy',
        'profiles',
        'providers',
        'readiness',
        'session',
        'settings',
        'social',
        'startup',
        'transport',
        'workspaces',
        'multiplayer',
        'watch',
      ].includes(firstSegment)
    )
      return { file: safePath(root, decoded) };
    if (decoded === '/favicon.ico') return { file: path.join(publicRoot, 'favicon.ico') };
    return { status: 404 };
  };
}

async function injectContextScript(file, contextScript) {
  let html = await readFile(file, 'utf8');
  const scriptTag = `<script src="/${contextScript.path}"></script>`;
  if (!html.includes(scriptTag)) html = html.replace('</head>', `${scriptTag}</head>`);
  return Buffer.from(html);
}

export async function sendFile(response, file, method = 'GET', contextScript = null) {
  try {
    let info = await stat(file);
    if (info.isDirectory()) {
      file = path.join(file, 'index.html');
      info = await stat(file);
    }
    if (!info.isFile()) return false;
    const isHtml = path.extname(file).toLowerCase() === '.html';
    const body = contextScript && isHtml ? await injectContextScript(file, contextScript) : null;
    response.writeHead(200, {
      'cache-control': 'no-store',
      connection: 'close',
      'content-length': body ? body.length : info.size,
      'content-type': MIME_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'content-security-policy':
        "default-src 'self'; base-uri 'self'; object-src 'none'; frame-src https:; connect-src 'self' https: wss:; img-src 'self' data: blob:; media-src 'self' blob:; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self' blob:",
      'cross-origin-opener-policy': 'same-origin',
      'cross-origin-resource-policy': 'same-origin',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'x-content-type-options': 'nosniff',
    });
    if (method === 'HEAD') response.end();
    else if (body) response.end(body);
    else createReadStream(file).pipe(response);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

export function createFrontendServer({
  host = '127.0.0.1',
  port = 4173,
  root = frontendRoot,
  publicRoot = repositoryRoot,
  logger = console,
  contextScript = null,
} = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new TypeError('port must be an integer between 0 and 65535');
  if (contextScript && (!contextScript.path || typeof contextScript.render !== 'function'))
    throw new TypeError('contextScript must provide a path and a render() function');
  const resolveAsset = createAssetResolver({
    root: path.resolve(root),
    publicRoot: path.resolve(publicRoot),
  });
  const server = createServer(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { allow: 'GET, HEAD' });
      response.end('Method Not Allowed');
      return;
    }
    const url = new URL(request.url || '/', `http://${request.headers.host || `${host}:${port}`}`);
    if (url.pathname === '/') {
      response.writeHead(302, { location: '/dashboard/?startup=1' });
      response.end();
      return;
    }
    if (url.pathname === '/dashboard' || url.pathname === '/dashboard/index.html') {
      if (url.pathname === '/dashboard') {
        response.writeHead(301, { location: '/dashboard/' });
        response.end();
        return;
      }
    }
    if (contextScript && url.pathname === `/${contextScript.path}`) {
      const body = Buffer.from(contextScript.render());
      response.writeHead(200, {
        'cache-control': 'no-store',
        connection: 'close',
        'content-length': body.length,
        'content-type': 'text/javascript; charset=utf-8',
        'content-security-policy': "script-src 'self'",
        'x-content-type-options': 'nosniff',
      });
      response.end(body);
      return;
    }
    const resolved = resolveAsset(url.pathname);
    if (resolved.status) {
      response.writeHead(resolved.status);
      response.end(resolved.status === 404 ? 'Not Found' : 'Bad Request');
      return;
    }
    if (
      !resolved.file ||
      !(await sendFile(response, resolved.file, request.method, contextScript))
    ) {
      response.writeHead(404);
      response.end('Not Found');
      return;
    }
  });
  server.on('clientError', (error, socket) => {
    logger.warn?.(`frontend client error: ${error.message}`);
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  });
  return {
    server,
    listen() {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => resolve(server.address()));
      });
    },
    close() {
      return new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

function readArgument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index < 0 ? fallback : process.argv[index + 1];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const host = String(readArgument('host', '127.0.0.1'));
  const port = Number(readArgument('port', 4173));
  const root = path.resolve(readArgument('root', frontendRoot));
  const publicRoot = path.resolve(
    readArgument('public-root', root === frontendRoot ? repositoryRoot : root),
  );
  const frontend = createFrontendServer({ host, port, root, publicRoot });
  frontend
    .listen()
    .then((address) =>
      console.log(
        JSON.stringify({
          service: 'spartan-frontend',
          url: `http://${address.address === '::' ? `[${address.address}]` : address.address}:${address.port}/dashboard/`,
          host: address.address,
          port: address.port,
        }),
      ),
    )
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
