import assert from 'node:assert/strict';
import test from 'node:test';
import {createSteamInputActionManifest, resolveSteamInputCapability, resolveSteamInputGlyph} from './steam-input.mjs';

test('Steam Input action manifest is portable and preserves the Gamepad/HID fallback', () => {
  const manifest = createSteamInputActionManifest();
  assert.equal(manifest.kind, 'steam-input-action-manifest'); assert.equal(manifest.fallback, 'gamepad-hid'); assert.ok(manifest.actions.some(action => action.id === 'confirm'));
  assert.throws(() => createSteamInputActionManifest({actions: [{id: 'confirm', label: 'A', type: 'button'}, {id: 'confirm', label: 'B', type: 'button'}]}), /duplicate/);
});

test('Steam Input capability requires an installed official bridge and always retains fallback', () => {
  assert.deepEqual(resolveSteamInputCapability({mode: 'official-actions'}), {mode: 'official-actions', state: 'fallback', officialActions: false, fallback: true, requires: ['gamepad-or-hid-input']});
  const bridge = {getGlyph: action => action === 'confirm' ? 'Steam A' : null, getActionState: () => ({pressed: false})};
  assert.equal(resolveSteamInputCapability({mode: 'official-actions', bridge}).officialActions, true);
  assert.deepEqual(resolveSteamInputGlyph({action: 'confirm', bridge}), {source: 'official-actions', action: 'confirm', glyph: 'Steam A'});
});

test('portable glyph fallbacks cover Xbox, PlayStation, Nintendo, and Steam families', () => {
  assert.equal(resolveSteamInputGlyph({action: 'confirm', family: 'xbox'}).glyph, 'A');
  assert.equal(resolveSteamInputGlyph({action: 'confirm', family: 'playstation'}).glyph, 'Cross');
  assert.equal(resolveSteamInputGlyph({action: 'confirm', family: 'nintendo'}).glyph, 'B');
  assert.equal(resolveSteamInputGlyph({action: 'cancel', family: 'steam'}).glyph, 'B');
});
