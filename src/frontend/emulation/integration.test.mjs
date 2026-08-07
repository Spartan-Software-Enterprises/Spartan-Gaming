import test from 'node:test';
import assert from 'node:assert/strict';
import {createEmulatorIntegration, emulatorTroubleshooting} from './integration.mjs';

const libretro = {id: 'libretro', mode: 'browser-or-native', systems: ['multi-system'], license: 'per-core'};
const pcsx2 = {id: 'pcsx2', mode: 'native', systems: ['playstation-2'], license: 'GPL-3.0-or-later'};

test('emulator integration selects browser runtime for compatible automatic cores', () => { const integration = createEmulatorIntegration({...libretro}, {report: {graphics: {webgpuAdapter: true}}}); assert.equal(integration.runtime, 'libretro-core'); assert.equal(integration.content.firmwareFiles, false); assert.ok(integration.features.includes('save-state')); });
test('emulator integration marks native firmware requirements explicitly', () => { const integration = createEmulatorIntegration(pcsx2); assert.equal(integration.runtime, 'native-adapter'); assert.equal(integration.content.firmwareFiles, true); assert.equal(emulatorTroubleshooting(integration)[0].key, 'firmware'); });
test('emulator integration supports explicit renderer and runtime choices', () => { const integration = createEmulatorIntegration({...libretro}, {preference: 'spartan-runtime', renderer: 'WebGPU', report: {graphics: {webgpuAdapter: false, webgl: false}}}); assert.equal(integration.runtime, 'browser-wasm'); assert.equal(integration.renderer, 'WebGPU'); assert.equal(emulatorTroubleshooting(integration).at(-1).key, 'graphics'); });
