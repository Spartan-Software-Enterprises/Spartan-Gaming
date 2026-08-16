import assert from 'node:assert/strict';
import test from 'node:test';
import { checkProviderReachability, normalizeProviderHealthTarget } from './health.mjs';

test('provider health targets strip query credentials and require secure remote URLs', () => {
  assert.equal(
    normalizeProviderHealthTarget('https://example.test/play?token=secret#now'),
    'https://example.test/play',
  );
  assert.throws(() => normalizeProviderHealthTarget('http://remote.example/play'), /HTTPS/);
  assert.throws(
    () => normalizeProviderHealthTarget('https://user:pass@example.test/'),
    /credentials/,
  );
  assert.equal(
    normalizeProviderHealthTarget('http://localhost:4173/health'),
    'http://localhost:4173/health',
  );
});

test('provider health probe uses GET without credentials and reports a reachable response', async () => {
  let request;
  const result = await checkProviderReachability({
    url: 'https://example.test/game?secret=removed',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { status: 204, ok: true, type: 'basic' };
    },
    now: (() => {
      let value = 10;
      return () => (value += 7);
    })(),
  });
  assert.equal(result.status, 'reachable');
  assert.equal(request.url, 'https://example.test/game');
  assert.equal(request.options.method, 'GET');
  assert.equal(request.options.credentials, 'include');
  assert.equal(request.options.redirect, 'follow');
});

test('provider health probe distinguishes opaque, timeout, and HTTP failure outcomes', async () => {
  const opaque = await checkProviderReachability({
    url: 'https://example.test',
    fetchImpl: async () => ({ status: 0, type: 'opaque' }),
  });
  assert.equal(opaque.status, 'indeterminate');
  const unavailable = await checkProviderReachability({
    url: 'https://example.test',
    fetchImpl: async () => ({ status: 503, type: 'basic' }),
  });
  assert.equal(unavailable.status, 'unavailable');
  const timeout = await checkProviderReachability({
    url: 'https://example.test',
    timeoutMs: 250,
    fetchImpl: async () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    },
  });
  assert.equal(timeout.status, 'timeout');
});
