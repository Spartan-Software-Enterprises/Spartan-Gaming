import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseFocusIndex, readNavigationAction} from './navigation.mjs';

const pad = (buttons, axes = []) => ({index: 0, buttons: Array.from({length: 16}, (_, index) => ({pressed: buttons.includes(index), value: buttons.includes(index) ? 1 : 0})), axes});
test('navigation actions emit only on button and axis rising edges', () => { assert.equal(readNavigationAction(pad([0])), 'confirm'); assert.equal(readNavigationAction(pad([0]), {buttons: [{pressed: true}]}), null); assert.equal(readNavigationAction(pad([], [-0.8])), 'left'); assert.equal(readNavigationAction(pad([], [-0.8]), {axes: [-0.8]}), null); });
test('focus navigation chooses the nearest control in the requested direction', () => { const elements = [{getBoundingClientRect: () => ({left: 0, top: 0, width: 10, height: 10})}, {getBoundingClientRect: () => ({left: 30, top: 0, width: 10, height: 10})}, {getBoundingClientRect: () => ({left: 0, top: 30, width: 10, height: 10})}]; assert.equal(chooseFocusIndex(elements, 0, 'right'), 1); assert.equal(chooseFocusIndex(elements, 0, 'down'), 2); });
