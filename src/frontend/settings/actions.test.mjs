import assert from 'node:assert/strict';
import test from 'node:test';
import { settingsCategories } from './settings-data.mjs';
import { SETTINGS_ACTIONS, resolveSettingsAction } from './actions.mjs';
import '../providers/session-cleanup.test.mjs';

test('every settings action has an explicit implementation contract', () => {
  const actions = settingsCategories.flatMap((category) =>
    category.settings.filter((setting) => setting.type === 'action').map((setting) => setting.key),
  );
  assert.deepEqual(new Set(actions), new Set(Object.keys(SETTINGS_ACTIONS)));
  for (const key of actions)
    assert.ok(resolveSettingsAction(key)?.kind, `${key} is missing an action kind`);
});

test('settings navigation and external actions stay within explicit destinations', () => {
  for (const action of Object.values(SETTINGS_ACTIONS)) {
    if (action.kind === 'navigate') assert.match(action.href, /^\.\.?\//);
    if (action.kind === 'external') assert.match(action.href, /^https:\/\//);
  }
});

test('provider session cleanup is an explicit state-changing action', () => {
  assert.equal(resolveSettingsAction('providers.clearSessions').kind, 'clear-provider-sessions');
});

test('developer tools are an explicit Electron action instead of a category loop', () => {
  assert.deepEqual(resolveSettingsAction('advanced.flags'), { kind: 'developer-tools' });
});

test('application updates use the Electron updater contract', () => {
  assert.deepEqual(resolveSettingsAction('updates.checkNow'), { kind: 'update-check' });
});
