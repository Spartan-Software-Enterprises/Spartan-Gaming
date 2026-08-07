export const CACHE_NAME = 'spartan-gaming-shell-v1';
export const PRECACHE_URLS = Object.freeze([
  '/src/frontend/dashboard/index.html', '/src/frontend/dashboard/dashboard.css', '/src/frontend/dashboard/dashboard.mjs',
  '/src/frontend/player/index.html', '/src/frontend/player/player.css', '/src/frontend/player/player.mjs',
  '/src/frontend/settings/index.html', '/src/frontend/settings/settings.css', '/src/frontend/settings/settings.mjs',
  '/src/frontend/host/index.html', '/src/frontend/host/host.css', '/src/frontend/host/host.mjs', '/src/frontend/host/host-page.mjs',
  '/src/frontend/host/browser-studio.html', '/src/frontend/host/browser-studio.css', '/src/frontend/host/browser-studio.mjs',
  '/src/frontend/diagnostics/index.html', '/src/frontend/diagnostics/diagnostics.css', '/src/frontend/diagnostics/diagnostics.mjs',
  '/providers/catalog.json', '/emulators/catalog.json',
]);

export function isCacheableRequest(request, locationLike = globalThis.location) { return request?.method === 'GET' && request?.url?.startsWith?.(`${locationLike?.origin || ''}/`) && !/\/signal|\/session|\/api\//.test(new URL(request.url).pathname); }
export function isCatalogRequest(url) { return /\/(providers|emulators)\/catalog\.json$/.test(new URL(url, 'https://spartangaming.invalid').pathname); }
