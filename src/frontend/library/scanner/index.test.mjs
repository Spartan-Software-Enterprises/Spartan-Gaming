import test from 'node:test';
import assert from 'node:assert/strict';
import { isRomFile, ROM_EXTENSIONS } from './index.mjs';

test('isRomFile identifies common ROM extensions', () => {
  assert.strictEqual(isRomFile('game.nes'), true);
  assert.strictEqual(isRomFile('game.smc'), true);
  assert.strictEqual(isRomFile('game.sf'), true);
  assert.strictEqual(isRomFile('game.gb'), true);
  assert.strictEqual(isRomFile('game.bin'), true);
  assert.strictEqual(isRomFile('game.txt'), false);
  assert.strictEqual(isRomFile('game.png'), false);
});

test('ROM_EXTENSIONS contains expected values', () => {
  assert.strictEqual(ROM_EXTENSIONS.has('nes'), true);
  assert.strictEqual(ROM_EXTENSIONS.has('smc'), true);
  assert.strictEqual(ROM_EXTENSIONS.has('gba'), true);
  assert.strictEqual(ROM_EXTENSIONS.has('unknown'), false);
});
