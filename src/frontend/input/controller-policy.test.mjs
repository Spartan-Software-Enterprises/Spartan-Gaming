import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONTROLLER_PROFILE_OPTIONS,
  controllerPolicyAllowsEvent,
  controllerPolicyFromSettings,
  controllerPollingIntervalMs,
  isControllerProfileSelection,
  normalizeControllerPolicy,
} from './controller-policy.mjs';

test('controller profile options include built-in profiles and auto-detect', () => {
  assert.ok(CONTROLLER_PROFILE_OPTIONS.includes('Auto-detect'));
  assert.ok(CONTROLLER_PROFILE_OPTIONS.includes('Xbox Elite / Elite 2'));
  assert.ok(CONTROLLER_PROFILE_OPTIONS.includes('Steam Deck'));
});

test('controller policy normalizes invalid selections to safe defaults', () => {
  const policy = normalizeControllerPolicy({
    defaultProfile: 'Not a Profile',
    inputMode: 'Sega Saturn',
    glyphStyle: 'N64',
    virtualGamepadBackend: 'Mystery',
    hapticsBackend: 'Wearable',
    playerSlots: 99,
    steeringRange: 0,
    deadzone: 100,
    inputLatency: 'Ultra',
  });
  assert.equal(policy.defaultProfile, 'Auto-detect');
  assert.equal(policy.inputMode, 'Auto-detect');
  assert.equal(policy.glyphStyle, 'Automatic');
  assert.equal(policy.virtualGamepadBackend, 'Automatic');
  assert.equal(policy.hapticsBackend, 'Automatic');
  assert.equal(policy.playerSlots, 8);
  assert.equal(policy.steeringRange, 90);
  assert.equal(policy.deadzone, 30);
  assert.equal(policy.inputLatency, 'Automatic');
});

test('controller policy accepts custom profile identifiers', () => {
  assert.equal(isControllerProfileSelection('Auto-detect'), true);
  assert.equal(isControllerProfileSelection('Xbox Elite / Elite 2'), true);
  assert.equal(isControllerProfileSelection('custom-living-room'), true);
  assert.equal(isControllerProfileSelection('a'), false);
  assert.equal(isControllerProfileSelection('Not a Profile'), false);
  assert.equal(isControllerProfileSelection(42), false);
});

test('controller policy maps settings onto bounded fields', () => {
  const policy = controllerPolicyFromSettings({
    'controllers.defaultProfile': 'Steam Deck',
    'controllers.playerSlots': 2,
    'controllers.allowGamepad': true,
    'controllers.allowHid': true,
    'controllers.rumble': true,
    'controllers.adaptiveTriggers': true,
    'controllers.inputLatency': 'High frequency',
  });
  assert.equal(policy.defaultProfile, 'Steam Deck');
  assert.equal(policy.playerSlots, 2);
  assert.equal(policy.allowGamepad, true);
  assert.equal(policy.allowHid, true);
  assert.equal(policy.rumble, true);
  assert.equal(policy.adaptiveTriggers, true);
  assert.equal(policy.inputLatency, 'High frequency');
});

test('controller polling interval maps latency choices to bounded values', () => {
  assert.equal(controllerPollingIntervalMs(), 100);
  assert.equal(controllerPollingIntervalMs('Automatic'), 100);
  assert.equal(controllerPollingIntervalMs('Standard'), 50);
  assert.equal(controllerPollingIntervalMs('High frequency'), 16);
  assert.equal(controllerPollingIntervalMs('Unknown'), 100);
});

test('controller policy gates gamepad events by slots and multiplicity', () => {
  const single = normalizeControllerPolicy({ multipleControllers: false, playerSlots: 1 });
  assert.equal(controllerPolicyAllowsEvent({ source: 'gamepad', gamepadIndex: 0 }, single), true);
  assert.equal(controllerPolicyAllowsEvent({ source: 'gamepad', gamepadIndex: 1 }, single), false);

  const twoPlayers = normalizeControllerPolicy({ multipleControllers: true, playerSlots: 2 });
  assert.equal(
    controllerPolicyAllowsEvent({ source: 'gamepad', gamepadIndex: 1 }, twoPlayers),
    true,
  );
  assert.equal(
    controllerPolicyAllowsEvent({ source: 'gamepad', gamepadIndex: 2 }, twoPlayers),
    false,
  );
});

test('controller policy gates HID events behind explicit opt-in', () => {
  const policy = normalizeControllerPolicy();
  assert.equal(controllerPolicyAllowsEvent({ source: 'hid' }, policy), false);
  const allowed = normalizeControllerPolicy({ allowHid: true });
  assert.equal(controllerPolicyAllowsEvent({ source: 'hid' }, allowed), true);
});

test('controller policy gates rumble behind gamepad, rumble, backend, and slots', () => {
  const policy = normalizeControllerPolicy({ allowGamepad: true, rumble: true });
  assert.equal(controllerPolicyAllowsEvent({ kind: 'rumble', gamepadIndex: 0 }, policy), true);
  const disabled = normalizeControllerPolicy({ allowGamepad: true, rumble: false });
  assert.equal(controllerPolicyAllowsEvent({ kind: 'rumble', gamepadIndex: 0 }, disabled), false);
  const noGamepad = normalizeControllerPolicy({ allowGamepad: false, rumble: true });
  assert.equal(controllerPolicyAllowsEvent({ kind: 'rumble', gamepadIndex: 0 }, noGamepad), false);
  const backendOff = normalizeControllerPolicy({ hapticsBackend: 'Disabled' });
  assert.equal(controllerPolicyAllowsEvent({ kind: 'rumble', gamepadIndex: 0 }, backendOff), false);
});

test('controller policy passes non-controller events through', () => {
  assert.equal(controllerPolicyAllowsEvent({ source: 'keyboard' }), true);
  assert.equal(controllerPolicyAllowsEvent({ kind: 'pointer' }), true);
});
