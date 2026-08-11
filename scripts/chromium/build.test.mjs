import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  createChromiumBuildPlan,
  createChromiumDevelopmentBuildMatrix,
  parseBuildArguments,
} from './build.mjs';

test('Chromium build plan maps every desktop target to its GN template and browser target', () => {
  for (const platform of ['linux', 'mac', 'windows']) {
    const plan = createChromiumBuildPlan({ platform, source: `/external/chromium/${platform}` });
    assert.equal(plan.target, 'chrome');
    assert.match(plan.artifact, new RegExp(`-${platform}$`));
    assert.equal(plan.commands[0].program, 'gn');
    assert.match(plan.commands[0].args[2], /is_official_build = false/);
    assert.deepEqual(plan.commands[1].args.slice(0, 2), ['-C', plan.out]);
  }
});

test('Chromium build options default to a plan and preserve explicit paths', () => {
  assert.deepEqual(
    parseBuildArguments([
      '--platform',
      'mac',
      '--source',
      '/tmp/chromium',
      '--out',
      'out/custom',
      '--target',
      'chrome',
      '--json',
    ]),
    {
      platform: 'mac',
      source: '/tmp/chromium',
      out: 'out/custom',
      target: 'chrome',
      execute: false,
      json: true,
      matrix: false,
    },
  );
});

test('Chromium build plans reject unsafe or unsupported targets', () => {
  assert.throws(
    () => createChromiumBuildPlan({ platform: 'android', source: '/external/chromium' }),
    /unsupported/,
  );
  assert.throws(
    () =>
      createChromiumBuildPlan({
        platform: 'linux',
        source: '/external/chromium',
        out: '/external/chromium',
      }),
    /must not equal/,
  );
  assert.throws(
    () =>
      createChromiumBuildPlan({
        platform: 'linux',
        source: '/external/chromium',
        out: process.cwd(),
      }),
    /outside/,
  );
});

test('Chromium development matrix covers each desktop artifact without sharing output directories', () => {
  const matrix = createChromiumDevelopmentBuildMatrix({
    source: '/external/chromium',
    outRoot: '/external/builds/spartan',
  });
  assert.deepEqual(
    matrix.map((plan) => plan.platform),
    ['linux', 'mac', 'windows'],
  );
  assert.deepEqual(
    matrix.map((plan) => plan.out),
    ['linux', 'mac', 'windows'].map((platform) =>
      path.resolve('/external/builds/spartan', platform),
    ),
  );
  assert.deepEqual(
    matrix.map((plan) => plan.binary),
    ['chrome', 'Chromium.app', 'chrome.exe'],
  );
});
