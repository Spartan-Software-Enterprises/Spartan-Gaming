import assert from 'node:assert/strict';
import test from 'node:test';
import { createLanDemo } from './lan-demo.mjs';

test('LAN demo composes frontend and authenticated signaling endpoints with scoped tickets', async () => {
  const demo = await createLanDemo({ ttlMs: 60_000 });
  try {
    assert.match(demo.frontendUrl, /\/dashboard\/$/);
    assert.match(demo.hostStudioUrl, /browser-studio\.html$/);
    assert.match(demo.signalingEndpoint, /^ws:\/\/127\.0\.0\.1:\d+\/signal$/);
    assert.notEqual(demo.hostTicket, demo.clientTicket);
    const page = await fetch(demo.frontendUrl);
    assert.equal(page.status, 200);
    const health = await fetch(
      demo.signalingEndpoint.replace('ws://', 'http://').replace('/signal', '/health'),
    );
    assert.equal(health.status, 200);
    assert.equal((await health.json()).service, 'spartan-signaling-reference');
  } finally {
    await demo.close();
  }
});

test('LAN demo rejects invalid session identifiers before opening services', async () => {
  await assert.rejects(() => createLanDemo({ sessionId: 'bad session' }), /invalid characters/);
});
