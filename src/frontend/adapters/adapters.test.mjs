import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatalogAdapterRegistry, resolveLaunchPlan} from './adapters.mjs';

const cloud = {id: 'cloud', name: 'Cloud', backendType: 'provider', integrationModes: ['browser-first', 'official-launch'], url: 'https://example.test', requirements: ['account'], capabilities: ['gamepad']};
const emulator = {id: 'emu', name: 'Emu', backendType: 'emulator', mode: 'browser-or-native', integrationModes: ['browser-or-native'], capabilities: ['gamepad']};

test('provider launch plans prefer an official browser handoff', () => { const plan = resolveLaunchPlan(cloud); assert.equal(plan.action, 'open-url'); assert.equal(plan.url, cloud.url); assert.deepEqual(plan.requirements, ['account']); });
test('emulator plans expose runtime choice instead of pretending to launch', () => { const plan = resolveLaunchPlan(emulator); assert.equal(plan.action, 'choose-runtime'); assert.equal(plan.external, false); });
test('unsupported modes return a structured support error', () => { const plan = resolveLaunchPlan({...cloud, integrationModes: ['private-api']}); assert.equal(plan.status, 'unsupported'); assert.equal(plan.action, 'show-support-error'); });
test('catalog adapter registry resolves immutable descriptors', () => { const registry = createCatalogAdapterRegistry([cloud, emulator]); assert.equal(registry.list().length, 2); assert.equal(registry.get('cloud').resolve().backendId, 'cloud'); assert.equal(Object.isFrozen(registry.get('cloud')), true); });
