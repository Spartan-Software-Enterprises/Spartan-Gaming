import assert from 'node:assert/strict';
import test from 'node:test';
import { CONTROLLER_PROFILE_CAPABILITIES } from './profiles.mjs';
import {
  createSteamInputActionManifest,
  negotiateSteamInputActions,
  resolveSteamInputCapability,
  resolveSteamInputGlyph,
} from './steam-input.mjs';

test('Steam Input action manifest is portable and preserves the Gamepad/HID fallback', () => {
  const manifest = createSteamInputActionManifest();
  assert.equal(manifest.kind, 'steam-input-action-manifest');
  assert.equal(manifest.fallback, 'gamepad-hid');
  assert.ok(manifest.actions.some((action) => action.id === 'confirm'));
  assert.throws(
    () =>
      createSteamInputActionManifest({
        actions: [
          { id: 'confirm', label: 'A', type: 'button' },
          { id: 'confirm', label: 'B', type: 'button' },
        ],
      }),
    /duplicate/,
  );
});

test('Steam Input capability requires an installed official bridge and always retains fallback', () => {
  assert.deepEqual(resolveSteamInputCapability({ mode: 'official-actions' }), {
    mode: 'official-actions',
    state: 'fallback',
    officialActions: false,
    fallback: true,
    requires: ['gamepad-or-hid-input'],
  });
  const bridge = {
    getGlyph: (action) => (action === 'confirm' ? 'Steam A' : null),
    getActionState: () => ({ pressed: false }),
  };
  assert.equal(
    resolveSteamInputCapability({ mode: 'official-actions', bridge }).officialActions,
    true,
  );
  assert.deepEqual(resolveSteamInputGlyph({ action: 'confirm', bridge }), {
    source: 'official-actions',
    action: 'confirm',
    glyph: 'Steam A',
  });
});

test('portable glyph fallbacks cover Xbox, PlayStation, Nintendo, and Steam families', () => {
  assert.equal(resolveSteamInputGlyph({ action: 'confirm', family: 'xbox' }).glyph, 'A');
  assert.equal(resolveSteamInputGlyph({ action: 'confirm', family: 'playstation' }).glyph, 'Cross');
  assert.equal(resolveSteamInputGlyph({ action: 'confirm', family: 'nintendo' }).glyph, 'B');
  assert.equal(resolveSteamInputGlyph({ action: 'cancel', family: 'steam' }).glyph, 'B');
});

test('Steam Deck action negotiation exposes supported controls and explicit missing capabilities', () => {
  const manifest = createSteamInputActionManifest();
  const partial = negotiateSteamInputActions({
    manifest,
    capabilities: ['gyro', 'backButtons'],
  });
  assert.ok(partial.supportedActions.includes('gyro'));
  assert.ok(
    partial.unavailableActions.some(
      (action) => action.id === 'trackpad-left' && action.missing.includes('trackpads'),
    ),
  );
  assert.ok(
    partial.unavailableActions.some(
      (action) => action.id === 'text-entry' && action.missing.includes('textEntry'),
    ),
  );
  const deck = negotiateSteamInputActions({
    manifest,
    capabilities: ['trackpads', 'gyro', 'backButtons', 'touchscreen', 'textEntry'],
  });
  assert.ok(deck.supportedActions.includes('trackpad-right'));
  assert.ok(deck.supportedActions.includes('text-entry'));
  assert.ok(
    deck.unavailableActions.some(
      (action) => action.id === 'haptic-feedback' && action.missing.includes('haptics'),
    ),
  );
  const complete = negotiateSteamInputActions({
    manifest,
    capabilities: [
      'trackpads',
      'gyro',
      'backButtons',
      'touchscreen',
      'textEntry',
      'haptics',
      'controllerNavigation',
    ],
  });
  assert.ok(complete.supportedActions.includes('haptic-feedback'));
  assert.ok(complete.supportedActions.includes('controller-navigation'));
});

test('controller profile capabilities negotiate Steam Input actions without vocabulary gaps', () => {
  const manifest = createSteamInputActionManifest();
  const required = [...new Set(manifest.actions.flatMap((action) => action.requires))];
  for (const token of required)
    assert.ok(
      CONTROLLER_PROFILE_CAPABILITIES.includes(token),
      `steam-input requires the shared capability token ${token}`,
    );
  const deck = negotiateSteamInputActions({
    manifest,
    capabilities: CONTROLLER_PROFILE_CAPABILITIES,
  });
  for (const action of manifest.actions) {
    assert.ok(
      deck.supportedActions.includes(action.id),
      `every manifest action ${action.id} is supported with the full profile vocabulary`,
    );
  }
});
