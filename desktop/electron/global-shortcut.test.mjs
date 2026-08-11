import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeGlobalShortcut } from '../../src/frontend/settings/electron-runtime.mjs';
import { createGlobalShortcutController } from './global-shortcut.mjs';

test('desktop global shortcut policy accepts only bounded accelerators', () => {
  assert.equal(normalizeGlobalShortcut('CommandOrControl+Shift+G'), 'CommandOrControl+Shift+G');
  assert.equal(normalizeGlobalShortcut('CommandOrControl+Alt+G'), 'CommandOrControl+Alt+G');
  assert.equal(normalizeGlobalShortcut('F1'), null);
  assert.equal(normalizeGlobalShortcut('Disabled'), null);
});

test('desktop global shortcut controller registers, replaces, disables, and disposes', () => {
  const registered = new Map();
  const removed = [];
  let activations = 0;
  const registry = {
    register(accelerator, callback) {
      registered.set(accelerator, callback);
      return true;
    },
    unregister(accelerator) {
      removed.push(accelerator);
      registered.delete(accelerator);
    },
  };
  const controller = createGlobalShortcutController({
    registry,
    onActivate: () => {
      activations += 1;
    },
  });
  assert.deepEqual(controller.sync('CommandOrControl+Shift+G'), {
    status: 'registered',
    accelerator: 'CommandOrControl+Shift+G',
  });
  registered.get('CommandOrControl+Shift+G')();
  assert.equal(activations, 1);
  assert.deepEqual(controller.sync('CommandOrControl+Alt+G'), {
    status: 'registered',
    accelerator: 'CommandOrControl+Alt+G',
  });
  assert.deepEqual(removed, ['CommandOrControl+Shift+G']);
  assert.deepEqual(controller.sync('Disabled'), { status: 'disabled', accelerator: null });
  controller.dispose();
  assert.equal(controller.state.status, 'disabled');
});

test('desktop global shortcut controller reports an occupied accelerator', () => {
  const controller = createGlobalShortcutController({
    registry: { register: () => false, unregister() {} },
    onActivate() {},
  });
  assert.deepEqual(controller.sync('CommandOrControl+Shift+G'), {
    status: 'unavailable',
    accelerator: 'CommandOrControl+Shift+G',
  });
});
