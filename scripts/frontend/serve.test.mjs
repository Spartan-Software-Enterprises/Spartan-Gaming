import assert from 'node:assert/strict';
import test from 'node:test';
import {createFrontendServer} from './serve.mjs';

async function withServer(run) {
  const frontend = createFrontendServer({port: 0, logger: {warn() {}}});
  const address = await frontend.listen();
  try { return await run(`http://127.0.0.1:${address.port}`); } finally { await frontend.close(); }
}

test('frontend server redirects the origin to the dashboard and serves catalogs', () => withServer(async origin => {
  const root = await fetch(origin, {redirect: 'manual'});
  assert.equal(root.status, 302);
  assert.equal(root.headers.get('location'), '/dashboard/?startup=1');
  const dashboard = await fetch(`${origin}/dashboard/`);
  assert.equal(dashboard.status, 200);
  const page = await fetch(`${origin}/dashboard/index.html`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Spartan Gaming/);
  assert.match(page.headers.get('content-security-policy'), /connect-src 'self' https: wss:/);
  assert.match(page.headers.get('content-security-policy'), /script-src 'self' blob:/);
  assert.equal(page.headers.get('cross-origin-opener-policy'), 'same-origin');
  assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
  const catalog = await fetch(`${origin}/providers/catalog.json`);
  assert.equal(catalog.status, 200);
  assert.equal((await catalog.json()).catalogVersion, 1);
  const emulation = await fetch(`${origin}/emulation/emulation-page.mjs`);
  assert.equal(emulation.status, 200);
  assert.match(await emulation.text(), /loadVerifiedBrowserEmulatorAdapter/);
}));

test('frontend server exposes the service worker aliases and rejects traversal', () => withServer(async origin => {
  const worker = await fetch(`${origin}/service-worker.mjs`);
  assert.equal(worker.status, 200);
  assert.match(await worker.text(), /pwa\/service-worker/);
  const legacy = await fetch(`${origin}/src/frontend/dashboard/index.html`);
  assert.equal(legacy.status, 200);
  const traversal = await fetch(`${origin}/dashboard/%2e%2e/%2e%2e/package.json`);
  assert.equal(traversal.status, 404);
  const method = await fetch(`${origin}/dashboard/index.html`, {method: 'POST'});
  assert.equal(method.status, 405);
}));

test('frontend server injects an app context script into served pages', async () => {
  const frontend = createFrontendServer({port: 0, logger: {warn() {}}, contextScript: {path: 'spartan-context.js', render: () => 'window.__SPARTAN_RELEASE_FEED__ = {schemaVersion: 1};'}});
  const address = await frontend.listen();
  try {
    const origin = `http://127.0.0.1:${address.port}`;
    const page = await fetch(`${origin}/dashboard/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<script src="\/spartan-context\.js"><\/script>/);
    const context = await fetch(`${origin}/spartan-context.js`);
    assert.equal(context.status, 200);
    assert.equal(context.headers.get('content-type'), 'text/javascript; charset=utf-8');
    assert.match(await context.text(), /__SPARTAN_RELEASE_FEED__/);
  } finally { await frontend.close(); }
});
