import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

test('Electron package configuration targets every desktop operating system', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const config = await readFile(path.join(root, 'desktop/electron-builder.yml'), 'utf8');
  assert.match(config, /AppImage/);
  assert.match(config, /dmg/);
  assert.match(config, /nsis/);
  assert.match(config, /schemes:/);
  assert.match(config, /- spartan/);
  assert.match(config, /executableName: Spartan-Gaming/);
  assert.match(config, /maintainer: Spartan Software Enterprises/);
  assert.match(config, /vendor: Spartan Software Enterprises/);
  assert.match(config, /syncDesktopName: true/);
  assert.match(config, /desktop\/electron/);
  assert.match(config, /src\/frontend/);
  assert.doesNotMatch(config, /scripts\/frontend/);
});

test('Electron shell keeps quit confirmation tied to the active session setting', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const main = await readFile(path.join(root, 'desktop/electron/main.mjs'), 'utf8');
  const preload = await readFile(path.join(root, 'desktop/electron/preload.mjs'), 'utf8');
  assert.match(main, /spartan:set-quit-guard/);
  assert.match(main, /spartan:set-session-active/);
  assert.match(main, /A gaming session is active/);
  assert.match(main, /event\.preventDefault\(\)/);
  assert.match(main, /requestSingleInstanceLock/);
  assert.match(main, /spartan:deep-link/);
  assert.match(main, /createBundledAppProtocolHandler/);
  assert.doesNotMatch(main, /createFrontendServer/);
  assert.match(main, /persist:spartan-gaming-providers/);
  assert.match(main, /did-create-window/);
  assert.match(preload, /setQuitGuard\(enabled\)/);
  assert.match(preload, /setSessionActive\(active\)/);
  assert.match(preload, /onDeepLink\(callback\)/);
  assert.match(main, /spartan:clear-provider-logins/);
  assert.match(preload, /clearProviderLogins\(\)/);
});
