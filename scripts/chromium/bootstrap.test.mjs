import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {createChromiumBootstrapPlan, parseBootstrapArguments} from './bootstrap.mjs';

test('Chromium bootstrap plans stay outside the repository and use depot_tools safely', () => {
  const checkout = fs.mkdtempSync(path.join(os.tmpdir(), 'spartan-chromium-'));
  const plan = createChromiumBootstrapPlan({platform: 'linux', checkout});
  assert.equal(plan.source, path.join(checkout, 'src')); assert.equal(plan.branch, 'refs/heads/main');
  assert.deepEqual(plan.commands.map(command => command.program), ['fetch', 'git', 'git', 'gclient', 'gclient']);
  assert.deepEqual(plan.commands[0].args, ['--nohooks', 'chromium']); assert.deepEqual(plan.commands[1].args, ['-C', plan.source, 'fetch', 'origin', 'refs/heads/main']); assert.deepEqual(plan.commands.at(-1).args, ['runhooks']);
});

test('Chromium bootstrap plans sync an existing external checkout without fetching twice', () => {
  const checkout = fs.mkdtempSync(path.join(os.tmpdir(), 'spartan-chromium-existing-')); fs.mkdirSync(path.join(checkout, 'src'));
  const plan = createChromiumBootstrapPlan({platform: 'windows', checkout});
  assert.deepEqual(plan.commands.map(command => command.program), ['git', 'git', 'gclient', 'gclient']);
});

test('Chromium bootstrap rejects repository-local checkout paths and malformed options', () => {
  assert.throws(() => createChromiumBootstrapPlan({platform: 'mac', checkout: process.cwd()}), /outside the Spartan Gaming repository/);
  assert.deepEqual(parseBootstrapArguments(['--platform', 'linux', '--checkout', '/tmp/chromium', '--json']).json, true);
  assert.throws(() => parseBootstrapArguments(['--unknown']), /unknown bootstrap option/);
});
