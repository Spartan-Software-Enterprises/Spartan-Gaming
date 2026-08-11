export const CACHE_NAME = 'spartan-gaming-shell-v3';
export const OFFLINE_FALLBACK = '/dashboard/index.html';
export const PRECACHE_URLS = Object.freeze([
  '/dashboard/index.html',
  '/dashboard/dashboard.css',
  '/dashboard/dashboard.mjs',
  '/dashboard/resume.mjs',
  '/startup/route.mjs',
  '/pwa/manifest.webmanifest',
  '/player/index.html',
  '/player/player.css',
  '/player/player.mjs',
  '/player/connection.mjs',
  '/session/recovery-handoff.mjs',
  '/settings/index.html',
  '/settings/settings.css',
  '/settings/settings.mjs',
  '/host/index.html',
  '/host/host.css',
  '/host/host.mjs',
  '/host/host-page.mjs',
  '/host/browser-studio.html',
  '/host/browser-studio.css',
  '/host/browser-studio.mjs',
  '/diagnostics/index.html',
  '/diagnostics/diagnostics.css',
  '/diagnostics/diagnostics.mjs',
  '/emulation/index.html',
  '/emulation/emulation.css',
  '/emulation/emulation-page.mjs',
  '/emulation/emulation.mjs',
  '/emulation/integration.mjs',
  '/providers/catalog.json',
  '/emulators/catalog.json',
  '/games/catalog.json',
]);

export function isNavigationRequest(request) {
  return Boolean(
    request?.mode === 'navigate' ||
    request?.destination === 'document' ||
    request?.headers?.get?.('accept')?.includes?.('text/html'),
  );
}
export function isCacheableRequest(request, locationLike = globalThis.location) {
  return (
    request?.method === 'GET' &&
    request?.url?.startsWith?.(`${locationLike?.origin || ''}/`) &&
    !/\/signal|\/session|\/api\//.test(new URL(request.url).pathname)
  );
}
export function isCatalogRequest(url) {
  return /\/(providers|emulators|games)\/catalog\.json$/.test(
    new URL(url, 'https://spartangaming.invalid').pathname,
  );
}
