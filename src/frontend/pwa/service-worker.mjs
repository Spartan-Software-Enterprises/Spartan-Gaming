import {CACHE_NAME, PRECACHE_URLS, isCacheableRequest, isCatalogRequest} from './cache.mjs';

const worker = globalThis.self;
if (worker?.addEventListener) {
  worker.addEventListener('install', event => event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS)).then(() => worker.skipWaiting())));
  worker.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => worker.clients.claim())));
  worker.addEventListener('fetch', event => { if (!isCacheableRequest(event.request)) return; event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => { if (response.ok && (isCatalogRequest(event.request.url) || event.request.destination === 'document' || event.request.destination === 'script' || event.request.destination === 'style')) caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone())); return response; }).catch(() => caches.match('/src/frontend/dashboard/index.html')))); });
}
