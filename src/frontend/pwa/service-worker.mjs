import {CACHE_NAME, OFFLINE_FALLBACK, PRECACHE_URLS, isCacheableRequest, isCatalogRequest, isNavigationRequest} from './cache.mjs';

const worker = globalThis.self;
if (worker?.addEventListener) {
  worker.addEventListener('install', event => event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS)).then(() => worker.skipWaiting())));
  worker.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => worker.clients.claim())));
  worker.addEventListener('message', event => { if (event.data?.type === 'spartan:skip-waiting') worker.skipWaiting(); });
  worker.addEventListener('fetch', event => {
    if (!isCacheableRequest(event.request)) return;
    event.respondWith((async () => {
      const cached = await caches.match(event.request);
      try {
        const response = await fetch(event.request);
        const shouldCache = response.ok && (isCatalogRequest(event.request.url) || isNavigationRequest(event.request) || ['script', 'style', 'manifest'].includes(event.request.destination));
        if (shouldCache) { const cache = await caches.open(CACHE_NAME); await cache.put(event.request, response.clone()); }
        return response;
      } catch {
        return cached || (isNavigationRequest(event.request) ? caches.match(new URL(OFFLINE_FALLBACK, event.request.url).href) : undefined) || new Response('Spartan Gaming is offline.', {status: 503, headers: {'content-type': 'text/plain; charset=utf-8'}});
      }
    })());
  });
}
