import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APP_ORIGIN,
  APP_PROTOCOL_PRIVILEGES,
  createBundledAppProtocolHandler,
  resolveBundledAssetCandidates,
} from './app-protocol.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const roots = { frontendRoot: path.join(root, 'src/frontend'), publicRoot: root };

test('private app protocol exposes only bounded packaged assets', () => {
  assert.equal(APP_PROTOCOL_PRIVILEGES.privileges.secure, true);
  assert.equal(
    resolveBundledAssetCandidates(`${APP_ORIGIN}/dashboard/`, roots)[0],
    path.join(root, 'src/frontend/dashboard'),
  );
  assert.equal(
    resolveBundledAssetCandidates(`${APP_ORIGIN}/providers/catalog.json`, roots)[0],
    path.join(root, 'providers/catalog.json'),
  );
  assert.deepEqual(resolveBundledAssetCandidates(`${APP_ORIGIN}/../../package.json`, roots), []);
  assert.deepEqual(resolveBundledAssetCandidates('https://example.com/dashboard/', roots), []);
});

test('private app protocol serves the offline dashboard and local catalogs', async () => {
  const handle = createBundledAppProtocolHandler(roots);
  const dashboard = await handle(new Request(`${APP_ORIGIN}/dashboard/`));
  assert.equal(dashboard.status, 200);
  assert.match(await dashboard.text(), /Spartan Gaming/);
  assert.match(dashboard.headers.get('content-security-policy'), /default-src 'self'/);
  const catalog = await handle(new Request(`${APP_ORIGIN}/providers/catalog.json`));
  assert.equal((await catalog.json()).catalogVersion, 1);
  assert.equal(
    (await handle(new Request(`${APP_ORIGIN}/dashboard/`, { method: 'POST' }))).status,
    405,
  );
  assert.equal((await handle(new Request(`${APP_ORIGIN}/not-packaged.txt`))).status, 404);
});
