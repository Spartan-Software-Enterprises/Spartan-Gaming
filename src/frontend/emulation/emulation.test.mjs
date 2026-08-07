import test from 'node:test';
import assert from 'node:assert/strict';
import {createEmulationLaunchPlan, createEmulationLibraryIndex, createUserFileRecord, formatFileSize} from './emulation.mjs';

const core = {id: 'dolphin', mode: 'native', systems: ['gamecube', 'wii'], license: 'GPL-2.0-or-later'};
test('user file records preserve selection metadata without file contents', () => { const record = createUserFileRecord({name: 'game.iso', size: 1024, lastModified: 10}); assert.equal(record.extension, 'iso'); assert.equal(record.userSelected, true); assert.equal(record.content, undefined); });
test('library index deduplicates selected files', () => { const file = {name: 'game.rom', size: 100}; assert.equal(createEmulationLibraryIndex([file, file]).length, 1); });
test('launch plans require legal user-selected game and firmware files', () => { const plan = createEmulationLaunchPlan({core, gameFile: {name: 'game.iso', size: 10}, firmwareFiles: [{name: 'bios.bin', size: 2}]}); assert.equal(plan.status, 'ready'); assert.deepEqual(plan.files.map(file => file.kind), ['game', 'firmware']); assert.equal(plan.policy.shipRoms, false); });
test('launch plans fail closed for missing license or unselected content', () => { assert.throws(() => createEmulationLaunchPlan({core: {...core, license: ''}, gameFile: {name: 'game.iso'}}), /license/); assert.throws(() => createEmulationLaunchPlan({core, gameFile: {name: 'game.iso', userSelected: false}}), /selected/); });
test('file sizes are human-readable', () => { assert.equal(formatFileSize(1024 ** 2), '1.0 MB'); });
