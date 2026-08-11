import {readFile, stat} from 'node:fs/promises';
import path from 'node:path';

export const APP_SCHEME = 'spartan-app';
export const APP_HOST = 'app';
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
export const APP_PROTOCOL_PRIVILEGES = Object.freeze({
  scheme: APP_SCHEME,
  privileges: Object.freeze({standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, codeCache: true}),
});

const FRONTEND_SECTIONS = new Set(['adapters', 'dashboard', 'diagnostics', 'emulation', 'host', 'input', 'player', 'providers', 'settings', 'startup', 'workspaces']);
const MIME_TYPES = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
});
const SECURITY_HEADERS = Object.freeze({
  'cache-control': 'no-store',
  'content-security-policy': "default-src 'self'; base-uri 'self'; object-src 'none'; frame-src https:; connect-src 'self' https: wss:; img-src 'self' data: blob:; media-src 'self' blob:; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self' blob:",
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-content-type-options': 'nosniff',
});

function safePath(root, pathname) {
  const candidate = path.resolve(root, `.${pathname}`);
  const relative = path.relative(root, candidate);
  return relative.startsWith('..') || path.isAbsolute(relative) ? null : candidate;
}

function decodedPathname(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== `${APP_SCHEME}:` || url.hostname !== APP_HOST || url.username || url.password) return null;
    const decoded = decodeURIComponent(url.pathname);
    if (!decoded.startsWith('/') || decoded.includes('\0')) return null;
    return decoded === '/' ? '/dashboard/index.html' : decoded;
  } catch {
    return null;
  }
}

/** Resolve a private app URL to bounded packaged-file candidates without touching the network. */
export function resolveBundledAssetCandidates(rawUrl, {frontendRoot, publicRoot} = {}) {
  const pathname = decodedPathname(rawUrl);
  if (!pathname || !frontendRoot || !publicRoot) return Object.freeze([]);
  if (pathname === '/service-worker.mjs') return Object.freeze([path.join(frontendRoot, 'service-worker.mjs')]);
  if (pathname.startsWith('/pwa/')) return Object.freeze([safePath(path.join(frontendRoot, 'pwa'), pathname.slice('/pwa'.length))].filter(Boolean));
  for (const mount of ['providers', 'emulators', 'games']) {
    if (pathname.startsWith(`/${mount}/`) && pathname.endsWith('.json')) return Object.freeze([safePath(path.join(publicRoot, mount), pathname.slice(mount.length + 1))].filter(Boolean));
  }
  if (pathname.startsWith('/src/frontend/')) return Object.freeze([safePath(frontendRoot, pathname.slice('/src/frontend'.length))].filter(Boolean));
  if (pathname === '/favicon.ico') return Object.freeze([path.join(publicRoot, 'favicon.ico')]);
  if (/\.(?:mjs|js)$/.test(pathname)) return Object.freeze([safePath(frontendRoot, pathname), safePath(publicRoot, pathname)].filter(Boolean));
  const firstSegment = pathname.split('/')[1];
  if (FRONTEND_SECTIONS.has(firstSegment)) return Object.freeze([safePath(frontendRoot, pathname)].filter(Boolean));
  return Object.freeze([]);
}

async function findFile(candidates, statImpl) {
  for (let candidate of candidates) {
    try {
      let info = await statImpl(candidate);
      if (info.isDirectory()) { candidate = path.join(candidate, 'index.html'); info = await statImpl(candidate); }
      if (info.isFile()) return Object.freeze({file: candidate, size: info.size});
    } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') throw error;
    }
  }
  return null;
}

/** Create Electron's in-process app protocol. No socket or HTTP server is opened. */
export function createBundledAppProtocolHandler({frontendRoot, publicRoot, readFileImpl = readFile, statImpl = stat} = {}) {
  const roots = Object.freeze({frontendRoot: path.resolve(frontendRoot), publicRoot: path.resolve(publicRoot)});
  return async request => {
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method Not Allowed', {status: 405, headers: {allow: 'GET, HEAD'}});
    const resolved = await findFile(resolveBundledAssetCandidates(request.url, roots), statImpl);
    if (!resolved) return new Response('Not Found', {status: 404, headers: SECURITY_HEADERS});
    const headers = {...SECURITY_HEADERS, 'content-length': String(resolved.size), 'content-type': MIME_TYPES[path.extname(resolved.file).toLowerCase()] || 'application/octet-stream'};
    return new Response(request.method === 'HEAD' ? null : await readFileImpl(resolved.file), {status: 200, headers});
  };
}
