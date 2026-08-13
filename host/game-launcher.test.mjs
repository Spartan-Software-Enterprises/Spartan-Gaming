import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameLaunchPlan, createGameLauncher } from './game-launcher.mjs';

const profile = {
  id: 'dolphin-local',
  kind: 'native-emulator',
  version: '5.0',
  trust: 'signed',
  enabled: true,
  executablePath: '/opt/dolphin',
};

test('game launch plans are local, shell-free, and append only the selected game file', () => {
  const plan = createGameLaunchPlan({
    platform: 'linux',
    runtimeProfile: profile,
    gamePath: '/games/mario.iso',
    args: ['--fullscreen'],
  });
  assert.equal(plan.kind, 'game-launch');
  assert.equal(plan.process.shell, false);
  assert.deepEqual(plan.process.args, ['--fullscreen', '/games/mario.iso']);
  assert.throws(
    () =>
      createGameLaunchPlan({
        platform: 'linux',
        runtimeProfile: profile,
        gamePath: 'https://example.test/game.iso',
      }),
    /local path/,
  );
  assert.throws(
    () =>
      createGameLaunchPlan({
        platform: 'linux',
        runtimeProfile: { ...profile, trust: 'unverified' },
        gamePath: '/games/a.iso',
      }),
    /trusted/,
  );
});

test('game launcher owns a bounded process lifecycle without starting during planning', async () => {
  const plan = createGameLaunchPlan({
    platform: 'linux',
    runtimeProfile: { ...profile, executablePath: process.execPath },
    gamePath: '/games/a.iso',
    args: ['-e', 'setInterval(() => {}, 1000)'],
  });
  const launcher = createGameLauncher({ plan });
  assert.equal(launcher.state, 'idle');
  await launcher.start();
  assert.equal(launcher.state, 'running');
  await launcher.stop();
  assert.equal(launcher.state, 'stopped');
});

test('Linux Windows runtimes launch through Wine without a shell', () => {
  const plan = createGameLaunchPlan({platform: 'linux', runtimeProfile: {...profile, platform: 'win32', executablePath: '/opt/emulators/pcsx2.exe'}, gamePath: '/games/game.iso'});
  assert.equal(plan.compatibility, 'wine');
  assert.equal(plan.process.executable, 'wine');
  assert.deepEqual(plan.process.args, ['/opt/emulators/pcsx2.exe', '/games/game.iso']);
  assert.equal(plan.process.shell, false);
});

test('PlayOnLinux runtime profiles use the named managed program', () => {
  const plan = createGameLaunchPlan({platform: 'linux', runtimeProfile: {...profile, execution: 'playonlinux', playOnLinuxProfile: 'Spartan PCSX2', executablePath: '/opt/emulators/pcsx2.exe'}, gamePath: '/games/game.iso'});
  assert.equal(plan.compatibility, 'wine');
  assert.equal(plan.process.executable, 'playonlinux');
  assert.deepEqual(plan.process.args, ['--run', 'Spartan PCSX2', '/opt/emulators/pcsx2.exe', '/games/game.iso']);
});
