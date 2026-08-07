import assert from 'node:assert/strict';
import test from 'node:test';
import {collectPermissionStates, collectPerformanceSnapshot} from './focus.mjs';

test('permission inspection is read-only and fails gracefully per API', async () => {
  const states = await collectPermissionStates({permissionsLike: {query: async ({name}) => ({state: name === 'camera' ? 'granted' : 'prompt'})}});
  assert.equal(states.find(item => item.name === 'camera').state, 'granted'); assert.equal(states.find(item => item.name === 'microphone').state, 'prompt');
  const unavailable = await collectPermissionStates({permissionsLike: {query: async () => { throw new Error('unsupported'); }}}); assert.ok(unavailable.every(item => item.state === 'unavailable'));
});

test('performance snapshot normalizes optional browser metrics', () => {
  const snapshot = collectPerformanceSnapshot({navigatorLike: {hardwareConcurrency: 8, deviceMemory: 16, connection: {effectiveType: '5g', downlink: 100, rtt: 18}}, performanceLike: {memory: {usedJSHeapSize: 4 * 1024 ** 2, jsHeapSizeLimit: 512 * 1024 ** 2}}});
  assert.deepEqual(snapshot, {logicalProcessors: 8, memoryGb: 16, effectiveType: '5g', downlinkMbps: 100, networkRttMs: 18, jsHeapUsedMb: 4, jsHeapLimitMb: 512});
});
