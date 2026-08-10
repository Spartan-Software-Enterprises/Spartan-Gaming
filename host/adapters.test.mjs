import test from 'node:test';
import assert from 'node:assert/strict';
import {createHostAdapterRegistry, createProcessLaunchPlan} from './adapters.mjs';

test('host adapter registry selects the platform-specific reference boundary', () => { const registry = createHostAdapterRegistry({platform: 'linux'}); assert.equal(registry.primary().id, 'linux-pipewire'); assert.equal(registry.primary().status, 'planned'); assert.equal(createHostAdapterRegistry({platform: 'android'}).list().length, 0); });
test('process launch plans are shell-free and bounded', () => { const plan = createProcessLaunchPlan({executable: '/games/demo', args: ['--fullscreen'], env: {SPARTAN_MODE: 'game'}}); assert.equal(plan.shell, false); assert.equal(plan.detached, false); assert.deepEqual(plan.args, ['--fullscreen']); assert.throws(() => createProcessLaunchPlan({executable: 'demo', args: Array(129).fill('x')}), /128/); });
