import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createProtonLaunchPlan,
  createProtonRuntimeProfile,
  detectProtonRuntime,
} from './proton.mjs';

test('Proton plans are Linux-only, shell-free, and place game arguments after the executable', () => {
  const profile = createProtonRuntimeProfile({
    protonPath: '/opt/Proton/proton',
    version: '9.0',
    compatDataPath: '/games/prefix',
    options: { PROTON_LOG: '1', PROTON_USE_WINED3D: '0' },
  });
  const plan = createProtonLaunchPlan({
    platform: 'linux',
    runtimeProfile: profile,
    gamePath: '/games/game.exe',
    gameArgs: ['-novid'],
  });
  assert.deepEqual(plan.process.args, ['run', '/games/game.exe', '-novid']);
  assert.equal(plan.process.shell, false);
  assert.equal(plan.process.env.STEAM_COMPAT_DATA_PATH, '/games/prefix');
  assert.throws(
    () =>
      createProtonLaunchPlan({
        platform: 'win32',
        runtimeProfile: profile,
        gamePath: '/games/game.exe',
      }),
    /Linux/,
  );
});

test('Proton environment options are allow-listed and bounded', () => {
  assert.throws(
    () =>
      createProtonRuntimeProfile({ protonPath: '/opt/proton', options: { LD_PRELOAD: 'evil.so' } }),
    /unsupported/,
  );
  assert.throws(
    () => createProtonRuntimeProfile({ protonPath: '/opt/proton', options: { PROTON_LOG: 'yes' } }),
    /0 or 1/,
  );
  assert.throws(
    () => createProtonRuntimeProfile({ protonPath: 'https://example.test/proton' }),
    /local path/,
  );
});

test('Proton detection reads a selected installation without executing it', () => {
  const files = new Map([
    ['/opt/proton/proton', { isFile: () => true }],
    ['/opt/proton/version', 'GE-Proton9-20\n'],
  ]);
  const profile = detectProtonRuntime({
    installRoot: '/opt/proton',
    stat: (value) => files.get(value),
    readFile: (value) => files.get(value),
  });
  assert.equal(profile.kind, 'proton');
  assert.equal(profile.version, 'GE-Proton9-20');
  assert.equal(profile.executablePath, '/opt/proton/proton');
  assert.throws(
    () =>
      detectProtonRuntime({
        installRoot: '/missing',
        stat: () => {
          throw new Error('missing');
        },
      }),
    /not found/,
  );
});
