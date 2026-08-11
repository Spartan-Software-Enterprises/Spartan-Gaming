import assert from 'node:assert/strict';
import test from 'node:test';
import { createStickyKeysController } from './sticky-keys.mjs';

test('sticky keys preserves ordinary keyboard events when disabled', () => {
  const controller = createStickyKeysController();
  assert.deepEqual(controller.process('ShiftLeft', true), [{ code: 'ShiftLeft', pressed: true }]);
  assert.deepEqual(controller.process('ShiftLeft', false), [{ code: 'ShiftLeft', pressed: false }]);
});

test('sticky keys releases a latched modifier after the next key chord', () => {
  const controller = createStickyKeysController({ enabled: true });
  assert.deepEqual(controller.process('ShiftLeft', true), [{ code: 'ShiftLeft', pressed: true }]);
  assert.deepEqual(controller.process('ShiftLeft', false), []);
  assert.deepEqual(controller.process('KeyA', true), [{ code: 'KeyA', pressed: true }]);
  assert.deepEqual(controller.process('KeyA', false), [
    { code: 'KeyA', pressed: false },
    { code: 'ShiftLeft', pressed: false },
  ]);
  assert.deepEqual(controller.flush(), []);
});

test('sticky keys can toggle a modifier off and flush safely', () => {
  const controller = createStickyKeysController({ enabled: true });
  controller.process('ControlLeft', true);
  assert.deepEqual(controller.process('ControlLeft', true), [
    { code: 'ControlLeft', pressed: false },
  ]);
  assert.deepEqual(controller.flush(), []);
});
