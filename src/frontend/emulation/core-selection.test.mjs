import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveEmulatorCoreForRom } from './core-selection.mjs';

const cores = [
  { id: 'libretro' },
  { id: 'sameboy' },
  { id: 'duckstation' },
  { id: 'pcsx2' },
  { id: 'dolphin' },
  { id: 'mame' },
];

test('ROM systems resolve to their corresponding integrated core', () => {
  assert.equal(resolveEmulatorCoreForRom({ system: 'game-boy-color' }, cores).id, 'sameboy');
  assert.equal(resolveEmulatorCoreForRom({ system: 'playstation-1' }, cores).id, 'duckstation');
  assert.equal(resolveEmulatorCoreForRom({ system: 'playstation-2' }, cores).id, 'pcsx2');
  assert.equal(resolveEmulatorCoreForRom({ system: 'gamecube' }, cores).id, 'dolphin');
  assert.equal(resolveEmulatorCoreForRom({ system: 'arcade' }, cores).id, 'mame');
});

test('ROM core selection falls back to the bundled multi-system core', () => {
  assert.equal(resolveEmulatorCoreForRom({ system: 'unknown-system' }, cores).id, 'libretro');
});
