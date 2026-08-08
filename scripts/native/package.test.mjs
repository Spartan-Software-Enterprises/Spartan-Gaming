import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {createNativePackageMatrix, createNativePackagePlan, parseNativePackageArguments} from './package.mjs';

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

test('native package readiness detects the buildable Linux package while other targets remain plan-only', () => {
  const plan = createNativePackagePlan({platform: 'linux'});
  assert.equal(plan.sourceDirectoryPresent, true);
  assert.equal(plan.sourcePresent, true);
});

test('native package CLI rejects malformed options and unsupported platforms', () => {
  assert.throws(() => createNativePackagePlan({platform: 'android', sourceRoot: '/external/spartan'}), /unsupported/);
  assert.throws(() => parseNativePackageArguments(['--unknown']), /unknown native package option/);
});
