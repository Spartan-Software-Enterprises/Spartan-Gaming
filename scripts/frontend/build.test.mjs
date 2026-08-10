import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {buildFrontendDistribution} from './build.mjs';
import {createFrontendServer} from './serve.mjs';

test('frontend distribution build packages pages, catalogs, service worker, and manifest', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'spartan-frontend-build-'));
  try {
    const result = await buildFrontendDistribution({outputRoot: path.join(root, 'dist')});
    assert.equal(result.manifest.product, 'Spartan Gaming');
    assert.equal(result.manifest.entrypoints.dashboard, '/dashboard/');
    assert.equal(result.manifest.entrypoints.adapters, '/adapters/');
    assert.match(await readFile(path.join(result.output, 'dashboard/index.html'), 'utf8'), /Spartan Gaming/);
    assert.match(await readFile(path.join(result.output, 'providers/catalog.json'), 'utf8'), /GeForce NOW/);
    assert.match(await readFile(path.join(result.output, 'games/catalog.json'), 'utf8'), /HexGL/);
    assert.match(await readFile(path.join(result.output, 'pwa/spartan-mark.svg'), 'utf8'), /Spartan Gaming/);
    assert.match(await readFile(path.join(result.output, 'service-worker.mjs'), 'utf8'), /pwa\/service-worker/);
  } finally { await rm(root, {recursive: true, force: true, maxRetries: 8, retryDelay: 100}); }
});

test('frontend distribution build refuses source and repository roots as output', async () => {
  await assert.rejects(() => buildFrontendDistribution({outputRoot: path.resolve('src/frontend')}), /source directory/);
  await assert.rejects(() => buildFrontendDistribution({outputRoot: path.resolve('.')}), /repository root/);
});

test('frontend server can serve the packaged distribution root', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'spartan-frontend-serve-build-'));
  const result = await buildFrontendDistribution({outputRoot: path.join(root, 'dist')});
  const frontend = createFrontendServer({root: result.output, publicRoot: result.output, port: 0, logger: {warn() {}}});
  const address = await frontend.listen();
  try {
    const page = await fetch(`http://127.0.0.1:${address.port}/dashboard/`);
    const adapters = await fetch(`http://127.0.0.1:${address.port}/adapters/`);
    const catalog = await fetch(`http://127.0.0.1:${address.port}/providers/catalog.json`);
    const games = await fetch(`http://127.0.0.1:${address.port}/games/catalog.json`);
    assert.equal(page.status, 200);
    assert.equal(adapters.status, 200);
    assert.equal(catalog.status, 200);
    assert.equal(games.status, 200);
  } finally { await frontend.close(); await rm(root, {recursive: true, force: true, maxRetries: 8, retryDelay: 100}); }
});
