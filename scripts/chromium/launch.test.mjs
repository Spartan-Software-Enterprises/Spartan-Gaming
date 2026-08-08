import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {chromiumBinaryPath, createChromiumShellPlan, launchChromiumShell, parseLaunchArguments} from './launch.mjs';

test('Chromium shell plans resolve platform binaries and safe app URLs', () => {
  assert.equal(chromiumBinaryPath({platform: 'linux', out: '/external/out'}), path.join(path.resolve('/external/out'), 'chrome'));
  assert.equal(chromiumBinaryPath({platform: 'mac', out: '/external/out'}), path.join(path.resolve('/external/out'), 'Chromium.app', 'Contents', 'MacOS', 'Chromium'));
  assert.equal(chromiumBinaryPath({platform: 'windows', out: '/external/out'}), path.join(path.resolve('/external/out'), 'chrome.exe'));
  const plan = createChromiumShellPlan({platform: 'linux', binary: '/usr/local/bin/chromium', url: 'http://127.0.0.1:4173/dashboard/', userDataDir: '/external/profile'});
  assert.deepEqual(plan.args, ['--app=http://127.0.0.1:4173/dashboard/', '--no-first-run', '--no-default-browser-check', '--user-data-dir=/external/profile']);
  assert.equal(plan.command.shell, false);
});

test('Chromium shell plans reject unsafe URLs and repository-owned paths', () => {
  assert.throws(() => createChromiumShellPlan({platform: 'linux', binary: '/usr/bin/chromium', url: 'http://remote.example/'}), /loopback/);
  assert.throws(() => createChromiumShellPlan({platform: 'linux', binary: process.cwd()}), /repository/);
  assert.throws(() => createChromiumShellPlan({platform: 'linux', out: process.cwd()}), /repository/);
});

test('Chromium shell launch arguments remain plan-first and cross-platform', () => {
  assert.deepEqual(parseLaunchArguments(['--platform', 'windows', '--out', '/external/chrome', '--serve', '--json']), {platform: 'windows', binary: '', out: '/external/chrome', url: '', frontendRoot: '', userDataDir: '', serve: true, execute: false, json: true});
});

test('Chromium shell can orchestrate a local HTTP frontend without shell execution', async () => {
  let invocation;
  const running = await launchChromiumShell({plan: createChromiumShellPlan({platform: 'linux', binary: process.execPath}), serve: true, spawnImpl: (program, args, options) => { invocation = {program, args, options}; return {kill() {}}; }});
  assert.equal(invocation.program, process.execPath);
  assert.equal(invocation.options.shell, false);
  assert.match(running.plan.url, /^http:\/\/127\.0\.0\.1:\d+\/dashboard\/$/);
  await running.close();
});
