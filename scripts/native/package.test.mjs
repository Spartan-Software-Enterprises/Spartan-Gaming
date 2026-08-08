import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {createNativePackageMatrix, createNativePackagePlan, parseNativePackageArguments} from './package.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('native package CLI maps all desktop targets to isolated plans', () => {
  const matrix = createNativePackageMatrix({sourceRoot: '/external/spartan', outRoot: '/external/out', installRoot: '/external/install'});
  assert.deepEqual(matrix.map(plan => plan.platform), ['win32', 'darwin', 'linux']);
  assert.deepEqual(matrix.map(plan => plan.out), ['win32', 'darwin', 'linux'].map(target => path.resolve('/external/out', target)));
  assert.ok(matrix.every(plan => plan.sourcePresent === false));
  assert.ok(matrix.every(plan => plan.commands[0].program === 'cmake'));
});

test('native package CLI accepts platform aliases and preserves a plan-only default', () => {
  const plan = createNativePackagePlan({platform: 'windows', sourceRoot: '/external/spartan'});
  assert.equal(plan.platform, 'win32');
  assert.equal(plan.package.platform, 'win32');
  assert.equal(plan.sourcePresent, false);
  assert.equal(parseNativePackageArguments(['--matrix', '--json', '--configuration', 'Debug']).configuration, 'Debug');
});

test('native package readiness detects all three checked-in platform package sources', () => {
  const plan = createNativePackagePlan({platform: 'linux'});
  assert.equal(plan.sourceDirectoryPresent, true);
  assert.equal(plan.sourcePresent, true);
  assert.ok(createNativePackagePlan({platform: 'windows'}).sourcePresent);
  assert.ok(createNativePackagePlan({platform: 'macos'}).sourcePresent);
});

test('desktop native package sources expose platform API implementations and package entrypoints', () => {
  const targets = [
    ['windows', 'src/bindings.cpp', 'SendInput'],
    ['macos', 'src/bindings.mm', 'CGEventPost'],
    ['linux', 'src/bindings.cpp', 'uinput'],
  ];
  for (const [target, sourceFile, marker] of targets) {
    const directory = path.join(repositoryRoot, 'native', target);
    assert.ok(fs.existsSync(path.join(directory, 'CMakeLists.txt')), `${target} CMakeLists.txt is required`);
    assert.ok(fs.existsSync(path.join(directory, 'index.mjs')), `${target} package entrypoint is required`);
    assert.ok(fs.existsSync(path.join(directory, 'package.json')), `${target} package manifest is required`);
    assert.match(fs.readFileSync(path.join(directory, sourceFile), 'utf8'), new RegExp(marker));
  }
});

test('native package CLI rejects malformed options and unsupported platforms', () => {
  assert.throws(() => createNativePackagePlan({platform: 'android', sourceRoot: '/external/spartan'}), /unsupported/);
  assert.throws(() => parseNativePackageArguments(['--unknown']), /unknown native package option/);
});
