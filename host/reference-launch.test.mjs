import assert from 'node:assert/strict';
import test from 'node:test';
import {createNativeHostLaunchRequest} from '../src/frontend/emulation/host-launch.mjs';
import {createReferenceGameLaunch} from './reference-launch.mjs';

function spawnImpl() {
  const listeners = new Map();
  return {pid: 321, stdout: {on() {}}, stderr: {on() {}}, once(event, handler) { listeners.set(event, handler); if (event === 'spawn') queueMicrotask(() => handler()); }, kill() { listeners.get('close')?.(0, null); }};
}

function request() {
  return createNativeHostLaunchRequest({plan: {status: 'ready', coreId: 'dolphin', files: [{kind: 'game', name: 'game.iso', size: 1, userSelected: true}], integration: {runtime: 'native-emulator', runtimeProfile: {id: 'dolphin', kind: 'native-emulator', version: '5', trust: 'signed', enabled: true}}}, hostContentId: 'dolphin-main', consent: true});
}

test('reference game launch config matches the host-local game before starting', async () => {
  const configured = createReferenceGameLaunch({platform: 'linux', runtimeId: 'dolphin', runtimePath: '/usr/bin/dolphin', gamePath: '/games/game.iso', hostContentId: 'dolphin-main', spawnImpl});
  assert.equal(configured.matches(request()), true);
  assert.equal(configured.descriptor.gameName, 'game.iso');
  await configured.launcher.start();
  assert.equal(configured.launcher.state, 'running');
  await configured.launcher.stop();
  assert.equal(configured.launcher.state, 'stopped');
});

test('reference game launch config rejects a mismatched content request', () => {
  const configured = createReferenceGameLaunch({platform: 'linux', runtimeId: 'dolphin', runtimePath: '/usr/bin/dolphin', gamePath: '/games/game.iso', hostContentId: 'dolphin-main', spawnImpl});
  const mismatched = {...request(), hostContentId: 'other'};
  assert.equal(configured.matches(mismatched), false);
  assert.throws(() => createReferenceGameLaunch({platform: 'linux', runtimeId: 'dolphin', runtimePath: '/usr/bin/dolphin', gamePath: '/games/game.iso', hostContentId: 'bad id', spawnImpl}), /unsupported/);
});
