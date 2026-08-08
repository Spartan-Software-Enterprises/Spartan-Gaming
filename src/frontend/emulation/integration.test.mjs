import test from 'node:test';
import assert from 'node:assert/strict';
import {createEmulatorIntegration, emulatorTroubleshooting} from './integration.mjs';

const libretro = {id: 'libretro', mode: 'browser-or-native', systems: ['multi-system'], license: 'per-core'};
const pcsx2 = {id: 'pcsx2', mode: 'native', systems: ['playstation-2'], license: 'GPL-3.0-or-later'};
const vita3k = {id: 'vita3k', mode: 'native', systems: ['playstation-vita'], license: 'GPL-2.0'};

test('emulator integration selects browser runtime for compatible automatic cores', () => { const integration = createEmulatorIntegration({...libretro}, {report: {graphics: {webgpuAdapter: true}}}); assert.equal(integration.runtime, 'libretro-core'); assert.equal(integration.content.firmwareFiles, false); assert.ok(integration.features.includes('save-state')); });
test('emulator integration marks native firmware requirements explicitly', () => { const integration = createEmulatorIntegration(pcsx2); assert.equal(integration.runtime, 'native-adapter'); assert.equal(integration.content.firmwareFiles, true); assert.equal(emulatorTroubleshooting(integration)[0].key, 'firmware'); });
test('emulator integration supports explicit renderer and runtime choices', () => { const integration = createEmulatorIntegration({...libretro}, {preference: 'spartan-runtime', renderer: 'WebGPU', report: {graphics: {webgpuAdapter: false, webgl: false}}}); assert.equal(integration.runtime, 'browser-wasm'); assert.equal(integration.renderer, 'WebGPU'); assert.equal(integration.browserReady, false); assert.equal(emulatorTroubleshooting(integration).at(-1).key, 'graphics'); });
test('emulator integration includes current native console adapters with explicit firmware policy', () => { const cemu = createEmulatorIntegration({id: 'cemu', mode: 'native', systems: ['wii-u'], license: 'MPL-2.0'}); assert.equal(cemu.controllerProfile, 'Nintendo layout'); assert.equal(cemu.content.firmwareFiles, false); assert.ok(cemu.features.includes('graphic-packs')); const vita = createEmulatorIntegration(vita3k); assert.equal(vita.content.firmwareFiles, true); assert.ok(vita.notes.some(note => /compatibility remains experimental/.test(note))); });
