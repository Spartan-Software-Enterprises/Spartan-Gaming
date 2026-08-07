import test from 'node:test';
import assert from 'node:assert/strict';
import {applyDeadzone, createInputMapper, normalizeGamepadState} from './input.mjs';

test('deadzone suppresses drift and rescales live input', () => { assert.equal(applyDeadzone(0.1, 0.2), 0); assert.ok(Math.abs(applyDeadzone(0.6, 0.2) - 0.5) < 0.001); assert.equal(applyDeadzone(-2), -1); });
test('gamepad state is normalized and immutable', () => { const state = normalizeGamepadState({id: 'Pad', index: 1, buttons: [{pressed: true, value: 1}], axes: [0.1, -0.5], timestamp: 4}); assert.equal(state.buttons[0].pressed, true); assert.equal(state.axes[0], 0); assert.ok(state.axes[1] < 0); assert.equal(Object.isFrozen(state), true); });
test('input mapper emits stable action events', () => { const mapper = createInputMapper({bindings: {confirm: 'button-0', moveLeft: 'axis-0-negative'}}); assert.deepEqual(mapper.mapButton(0, true), {type: 'input.event', action: 'confirm', pressed: true, value: 1}); assert.equal(mapper.mapAxis(0, -0.8).action, 'moveLeft'); assert.equal(mapper.mapAxis(0, 0.03), null); });
