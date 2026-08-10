import assert from 'node:assert/strict';
import test from 'node:test';
import {createGamescopeLaunchPlan, createSteamOsLaunchReadiness, detectSteamOs, normalizeSteamOsProfile} from './steam-os.mjs';

test('SteamOS detection requires an explicit os-release identity', () => {
  assert.equal(detectSteamOs({platform: 'linux', readFile: () => 'NAME="Generic Linux"\nID=linux\n'}).detected, false);
  const profile = detectSteamOs({platform: 'linux', readFile: () => 'NAME="SteamOS"\nID=steamos\n'});
  assert.equal(profile.detected, true); assert.equal(profile.width, 1280); assert.equal(profile.height, 800); assert.equal(profile.controllerOnlyNavigation, true); assert.equal(profile.fullscreen, true); assert.equal(profile.overlaySafeInputFocus, true); assert.equal(profile.sleepWakeRecovery, 'session-reconnect'); assert.deepEqual(profile.power.supportedFramerates, [30, 40, 60]);
});

test('SteamOS policy bounds handheld refresh choices and rejects non-Linux hosts', () => {
  assert.equal(normalizeSteamOsProfile({detected: true, framerate: 40}).framerate, 40);
  assert.throws(() => normalizeSteamOsProfile({detected: true, framerate: 144}), /30, 40, or 60/);
  assert.throws(() => normalizeSteamOsProfile({platform: 'win32'}), /Linux/);
});

test('Gamescope plans are explicit, shell-free, and require detected SteamOS', () => {
  const plan = createGamescopeLaunchPlan({profile: normalizeSteamOsProfile({detected: true, gamescopeEnabled: true, framerate: 30}), gamescopePath: '/usr/bin/gamescope', gamePath: '/games/game.exe', gameArgs: ['-novid']});
  assert.deepEqual(plan.process.args, ['-W', '1280', '-H', '800', '-r', '30', '-f', '--', '/games/game.exe', '-novid']); assert.equal(plan.process.shell, false);
  assert.throws(() => createGamescopeLaunchPlan({profile: normalizeSteamOsProfile({detected: false, gamescopeEnabled: true}), gamescopePath: '/usr/bin/gamescope', gamePath: '/games/game.exe'}), /detected/);
});

test('SteamOS launch readiness distinguishes native, Proton, Steam, and non-Steam choices', () => {
  assert.equal(createSteamOsLaunchReadiness({mode: 'native-linux', gamePathSelected: true}).status, 'ready');
  assert.deepEqual(createSteamOsLaunchReadiness({mode: 'proton'}).requires, ['proton-installation', 'user-selected-game-file']);
  assert.equal(createSteamOsLaunchReadiness({mode: 'steam', steamAppId: '12345'}).status, 'official-handoff-required');
  assert.equal(createSteamOsLaunchReadiness({mode: 'non-steam', gamePathSelected: true}).status, 'bridge-required');
  assert.throws(() => createSteamOsLaunchReadiness({steamAppId: 'not-an-id'}), /numeric/);
});
