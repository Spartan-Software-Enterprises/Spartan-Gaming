import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {buildFrontendDistribution} from './build.mjs';

test('frontend distribution build packages pages, catalogs, service worker, and manifest', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'spartan-frontend-build-'));
  try {
    const result = await buildFrontendDistribution({outputRoot: path.join(root, 'dist')});
    assert.equal(result.manifest.product, 'Spartan Gaming');
    assert.equal(result.manifest.entrypoints.dashboard, '/dashboard/');
    assert.match(await readFile(path.join(result.output, 'dashboard/index.html'), 'utf8'), /Spartan Gaming/);
    assert.match(await readFile(path.join(result.output, 'providers/catalog.json'), 'utf8'), /GeForce NOW/);
    assert.match(await readFile(path.join(result.output, 'service-worker.mjs'), 'utf8'), /pwa\/service-worker/);
  } finally { await rm(root, {recursive: true, force: true}); }
});

test('frontend distribution build refuses source and repository roots as output', async () => {
  await assert.rejects(() => buildFrontendDistribution({outputRoot: path.resolve('src/frontend')}), /source directory/);
  await assert.rejects(() => buildFrontendDistribution({outputRoot: path.resolve('.')}), /repository root/);
});

