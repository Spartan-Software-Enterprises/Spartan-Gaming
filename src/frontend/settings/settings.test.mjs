import assert from 'node:assert/strict';
import test from 'node:test';
import {defaultSettings, settingsCategories} from './settings-data.mjs';

test('settings registry has unique keys and defaults', () => {
  const settings = settingsCategories.flatMap((category) => category.settings);
  const keys = settings.map((setting) => setting.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(settings.length >= 80);
  for (const setting of settings.filter((item) => item.type !== 'action')) {
    assert.ok(setting.key in defaultSettings, `${setting.key} is missing a default`);
  }
  for (const category of settingsCategories) {
    assert.ok(category.id && category.label && category.description);
    assert.ok(category.settings.length > 0);
  }
});

