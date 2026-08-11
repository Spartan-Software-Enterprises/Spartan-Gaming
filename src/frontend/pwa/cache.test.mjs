import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CACHE_NAME,
  OFFLINE_FALLBACK,
  PRECACHE_URLS,
  isCacheableRequest,
  isCatalogRequest,
  isNavigationRequest,
} from './cache.mjs';

test('PWA cache policy includes shell and catalogs but excludes session paths', () => {
  assert.match(CACHE_NAME, /^spartan-gaming-/);
  assert.ok(PRECACHE_URLS.includes('/pwa/manifest.webmanifest'));
  assert.ok(PRECACHE_URLS.includes('/providers/catalog.json'));
  assert.ok(PRECACHE_URLS.includes('/games/catalog.json'));
  assert.ok(PRECACHE_URLS.includes('/host/browser-studio.html'));
  assert.ok(PRECACHE_URLS.includes('/player/connection.mjs'));
  assert.ok(PRECACHE_URLS.includes('/session/recovery-handoff.mjs'));
  assert.ok(PRECACHE_URLS.includes('/emulation/index.html'));
  assert.ok(PRECACHE_URLS.includes('/emulation/emulation.mjs'));
  assert.equal(
    isCacheableRequest(
      { method: 'GET', url: 'https://example.test/dashboard/index.html' },
      { origin: 'https://example.test' },
    ),
    true,
  );
  assert.equal(
    isCacheableRequest(
      { method: 'POST', url: 'https://example.test/session' },
      { origin: 'https://example.test' },
    ),
    false,
  );
  assert.equal(
    isCacheableRequest(
      { method: 'GET', url: 'https://example.test/signal' },
      { origin: 'https://example.test' },
    ),
    false,
  );
});
test('catalog detection is limited to public manifests', () => {
  assert.equal(isCatalogRequest('/providers/catalog.json'), true);
  assert.equal(isCatalogRequest('/emulators/catalog.json'), true);
  assert.equal(isCatalogRequest('/games/catalog.json'), true);
  assert.equal(isCatalogRequest('/session/catalog.json'), false);
});
test('offline navigation policy identifies documents and keeps one shell fallback', () => {
  assert.equal(OFFLINE_FALLBACK, '/dashboard/index.html');
  assert.equal(isNavigationRequest({ mode: 'navigate' }), true);
  assert.equal(isNavigationRequest({ destination: 'script' }), false);
  assert.equal(
    isNavigationRequest({ headers: { get: () => 'text/html,application/xhtml+xml' } }),
    true,
  );
});
