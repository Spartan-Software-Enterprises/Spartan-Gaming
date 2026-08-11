import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test('Electron package configuration targets every desktop operating system', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const config = await readFile(path.join(root, 'desktop/electron-builder.yml'), 'utf8');
  const icon = await readFile(path.join(root, 'desktop/build-resources/icon.svg'), 'utf8');
  assert.match(config, /AppImage/);
  assert.match(config, /dmg/);
  assert.match(config, /- zip/);
  assert.match(config, /nsis/);
  assert.match(config, /schemes:/);
  assert.match(config, /- spartan/);
  assert.match(config, /executableName: Spartan-Gaming/);
  assert.match(config, /maintainer: Spartan Software Enterprises/);
  assert.match(config, /vendor: Spartan Software Enterprises/);
  assert.match(config, /syncDesktopName: true/);
  assert.match(config, /electronUpdaterCompatibility: ['"]>=2\.16['"]/);
  assert.match(config, /provider: github/);
  assert.match(config, /owner: Spartan-Software-Enterprises/);
  assert.match(config, /repo: Spartan-Gaming/);
  assert.match(config, /desktop\/electron/);
  assert.match(config, /src\/frontend/);
  assert.doesNotMatch(config, /scripts\/frontend/);
  assert.match(icon, /<svg[^>]+viewBox="0 0 64 64"/);
  assert.match(icon, /Spartan Gaming/);
});

test('Electron shell keeps quit confirmation tied to the active session setting', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const main = await readFile(path.join(root, 'desktop/electron/main.mjs'), 'utf8');
  const preload = await readFile(path.join(root, 'desktop/electron/preload.cjs'), 'utf8');
  const providerSession = await readFile(
    path.join(root, 'desktop/electron/provider-session.mjs'),
    'utf8',
  );
  assert.match(main, /spartan:set-quit-guard/);
  assert.match(main, /spartan:set-session-active/);
  assert.match(main, /sandbox: true/);
  assert.match(main, /preload\.cjs/);
  assert.match(main, /A gaming session is active/);
  assert.match(main, /event\.preventDefault\(\)/);
  assert.match(main, /requestSingleInstanceLock/);
  assert.match(main, /spartan:deep-link/);
  assert.match(main, /createBundledAppProtocolHandler/);
  assert.doesNotMatch(main, /createFrontendServer/);
  assert.match(main, /resolveProviderPartition/);
  assert.match(main, /providerSessionPartitions/);
  assert.match(main, /providerChildWindows/);
  assert.match(main, /providerSessionActive/);
  assert.match(main, /applicationSessionActive/);
  assert.match(main, /clearAuthCache/);
  assert.match(providerSession, /persist:spartan-gaming-providers/);
  assert.match(main, /did-create-window/);
  assert.match(preload, /setQuitGuard\(enabled\)/);
  assert.match(preload, /require\('electron'\)/);
  assert.doesNotMatch(preload, /^import /m);
  assert.match(preload, /setSessionActive\(active\)/);
  assert.match(preload, /onDeepLink\(callback\)/);
  assert.match(main, /spartan:clear-provider-logins/);
  assert.match(preload, /clearProviderLogins\(\)/);
  assert.match(main, /spartan:export-diagnostics/);
  assert.match(main, /spartan:clear-diagnostics/);
  assert.match(preload, /exportDiagnostics\(\)/);
  assert.match(preload, /clearDiagnostics\(\)/);
  assert.match(main, /createElectronUpdateController/);
  assert.match(main, /spartan:check-for-updates/);
  assert.match(main, /spartan:get-update-status/);
  assert.match(main, /loadElectronUpdater/);
  assert.match(preload, /checkForUpdates\(\)/);
  assert.match(preload, /getUpdateStatus\(\)/);
  assert.match(preload, /onUpdateStatus\(callback\)/);
});
