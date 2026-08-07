import assert from 'node:assert/strict';
import test from 'node:test';
import {createChromiumBuildPlan, parseBuildArguments} from './build.mjs';

test('Chromium build plan maps every desktop target to its GN template and browser target', () => {
  for (const platform of ['linux', 'mac', 'windows']) {
    const plan = createChromiumBuildPlan({platform, source: `/external/chromium/${platform}`});
    assert.equal(plan.target, 'chrome');
    assert.equal(plan.commands[0].program, 'gn');
    assert.match(plan.commands[0].args[2], /is_official_build = false/);
    assert.deepEqual(plan.commands[1].args.slice(0, 2), ['-C', plan.out]);
  }
});

test('Chromium build options default to a plan and preserve explicit paths', () => {
  assert.deepEqual(parseBuildArguments(['--platform', 'mac', '--source', '/tmp/chromium', '--out', 'out/custom', '--target', 'chrome', '--json']), {platform: 'mac', source: '/tmp/chromium', out: 'out/custom', target: 'chrome', execute: false, json: true});
});

test('Chromium build plans reject unsafe or unsupported targets', () => {
  assert.throws(() => createChromiumBuildPlan({platform: 'android', source: '/external/chromium'}), /unsupported/);
  assert.throws(() => createChromiumBuildPlan({platform: 'linux', source: '/external/chromium', out: '/external/chromium'}), /must not equal/);
});
