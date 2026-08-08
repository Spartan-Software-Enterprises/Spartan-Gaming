import assert from 'node:assert/strict';
import test from 'node:test';
import {createTouchControlEvent, createTouchControlLayout, normalizeTouchLayout} from './touch-controls.mjs';

test('touch layouts normalize settings into bounded controller controls', () => { assert.equal(normalizeTouchLayout('Minimal'), 'minimal'); assert.equal(normalizeTouchLayout('Automatic'), 'full'); assert.equal(normalizeTouchLayout('Off'), 'off'); assert.equal(createTouchControlLayout('minimal').length, 2); assert.equal(createTouchControlLayout('full').length, 8); assert.deepEqual(createTouchControlLayout('full')[0], {id: 'moveUp', label: '▲', action: 'moveUp', group: 'dpad'}); });
test('touch control events use the shared input vocabulary and button bounds', () => { assert.deepEqual(createTouchControlEvent({action: 'confirm', pressed: true}), {type: 'input.event', action: 'confirm', kind: 'button', source: 'touch', control: 'confirm', pressed: true, value: 1}); assert.equal(createTouchControlEvent({action: 'cancel', pressed: false}).value, 0); assert.throws(() => createTouchControlEvent({action: ''}), /touch action/); });
