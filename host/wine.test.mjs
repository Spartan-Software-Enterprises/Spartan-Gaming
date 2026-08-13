import assert from 'node:assert/strict';
import test from 'node:test';
import {createWineLaunch, resolveWineBackend} from './wine.mjs';

test('Wine backend selects an available direct Wine runtime', () => {
  const result = resolveWineBackend({platform: 'linux', probe: command => ({status: command === 'wine' ? 0 : 1})});
  assert.equal(result.backend, 'wine');
  assert.equal(result.wine, true);
});

test('PlayOnLinux launch plans remain shell-free and require a managed profile', () => {
  const plan = createWineLaunch({backend: 'playonlinux', executable: '/games/emulator.exe', args: ['--fullscreen'], playOnLinuxProfile: 'Spartan Emulator'});
  assert.deepEqual(plan, {executable: 'playonlinux', args: ['--run', 'Spartan Emulator', '/games/emulator.exe', '--fullscreen'], backend: 'playonlinux'});
  assert.throws(() => createWineLaunch({backend: 'playonlinux', executable: '/games/emulator.exe'}), /profile/);
});
