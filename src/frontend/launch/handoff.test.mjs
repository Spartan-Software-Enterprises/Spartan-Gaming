import assert from 'node:assert/strict';
import test from 'node:test';
import {createNativeHostLaunchRequest} from '../emulation/host-launch.mjs';
import {clearPendingLaunchHandoff, readPendingLaunchHandoff, savePendingLaunchHandoff} from './handoff.mjs';

function storage() {
  const values = new Map();
  return {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key)};
}

function request() {
  return createNativeHostLaunchRequest({
    plan: {
      status: 'ready', coreId: 'dolphin', files: [{kind: 'game', name: 'game.iso', size: 42, userSelected: true}],
      integration: {runtime: 'native-emulator', runtimeProfile: {id: 'dolphin-linux', kind: 'native-emulator', version: '5', trust: 'signed', enabled: true}},
    },
    hostContentId: 'gamecube-dolphin', consent: true,
  });
}

test('launch handoffs persist only a normalized metadata request in session storage', () => {
  const backend = storage();
  const saved = savePendingLaunchHandoff(backend, {request: request(), backendId: 'dolphin', name: 'Dolphin'});
  const restored = readPendingLaunchHandoff(backend);
  assert.deepEqual(restored, saved);
  assert.equal(JSON.stringify(saved).includes('source'), false);
  clearPendingLaunchHandoff(backend);
  assert.equal(readPendingLaunchHandoff(backend), null);
});

test('expired or malformed launch handoffs fail closed', () => {
  const backend = storage();
  savePendingLaunchHandoff(backend, {request: request(), backendId: 'dolphin', name: 'Dolphin', now: 1000});
  assert.equal(readPendingLaunchHandoff(backend, {now: 1000 + 10 * 60 * 1000 + 1}), null);
  backend.setItem('spartan-gaming.pending-launch-handoff.v1', JSON.stringify({version: 1, backendId: 'dolphin', name: 'Dolphin', createdAt: new Date().toISOString(), request: {}}));
  assert.equal(readPendingLaunchHandoff(backend), null);
});
