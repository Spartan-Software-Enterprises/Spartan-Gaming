import assert from 'node:assert/strict';
import test from 'node:test';
import {createTrayMenuTemplate, shouldCreateTray} from './tray-policy.mjs';

test('background app setting controls tray availability', () => {
  assert.equal(shouldCreateTray({backgroundApps: true}), true);
  assert.equal(shouldCreateTray({backgroundApps: false}), false);
  assert.equal(shouldCreateTray({backgroundApps: 'true'}), false);
});

test('tray menu exposes restore and quit actions', () => {
  const actions = [];
  const menu = createTrayMenuTemplate({onShow: () => actions.push('show'), onQuit: () => actions.push('quit')});
  assert.deepEqual(menu.map(item => item.label || item.type), ['Show Spartan Gaming', 'separator', 'Quit Spartan Gaming']);
  menu[0].click(); menu[2].click(); assert.deepEqual(actions, ['show', 'quit']);
});
