import assert from 'node:assert/strict';
import test from 'node:test';
import {createInputPermissionPolicy} from './policy.mjs';

test('input policy reflects negotiated controller permissions', () => {
  const policy = createInputPermissionPolicy({input: {gamepad: false, keyboard: true, pointer: false}});
  assert.equal(policy.allows('gamepad'), false);
  assert.equal(policy.allows('keyboard'), true);
  assert.equal(policy.allows('pointer'), false);
  assert.match(policy.reason('gamepad'), /disabled/);
});

test('input policy defaults to browser-safe local controls', () => {
  const policy = createInputPermissionPolicy();
  assert.equal(policy.allows('gamepad'), true);
  assert.equal(policy.allows('keyboard'), true);
  assert.equal(policy.allows('host'), false);
});

test('input policy keeps HID disabled until explicitly negotiated', () => { assert.equal(createInputPermissionPolicy().allows('hid'), false); assert.equal(createInputPermissionPolicy({input: {hid: true}}).allows('hid'), true); });
