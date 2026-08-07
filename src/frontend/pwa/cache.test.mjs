import test from 'node:test';
import assert from 'node:assert/strict';
import {CACHE_NAME, PRECACHE_URLS, isCacheableRequest, isCatalogRequest} from './cache.mjs';

test('PWA cache policy includes shell and catalogs but excludes session paths', () => { assert.match(CACHE_NAME, /^spartan-gaming-/); assert.ok(PRECACHE_URLS.includes('/providers/catalog.json')); assert.equal(isCacheableRequest({method: 'GET', url: 'https://example.test/src/frontend/dashboard/index.html'}, {origin: 'https://example.test'}), true); assert.equal(isCacheableRequest({method: 'POST', url: 'https://example.test/session'}, {origin: 'https://example.test'}), false); assert.equal(isCacheableRequest({method: 'GET', url: 'https://example.test/signal'}, {origin: 'https://example.test'}), false); });
test('catalog detection is limited to public manifests', () => { assert.equal(isCatalogRequest('/providers/catalog.json'), true); assert.equal(isCatalogRequest('/emulators/catalog.json'), true); assert.equal(isCatalogRequest('/session/catalog.json'), false); });
