import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { defaultSettings, settingsCategories } from './settings-data.mjs';
import { normalizeControllerPolicy } from '../input/controller-policy.mjs';
import './control.test.mjs';

test('settings registry has unique keys and defaults', () => {
  const settings = settingsCategories.flatMap((category) => category.settings);
  const keys = settings.map((setting) => setting.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(keys.includes('general.defaultSearch'), false);
  assert.ok(settings.length >= 80);
  for (const setting of settings.filter((item) => item.type !== 'action')) {
    assert.ok(setting.key in defaultSettings, `${setting.key} is missing a default`);
  }
  for (const category of settingsCategories) {
    assert.ok(category.id && category.label && category.description);
    assert.ok(category.settings.length > 0);
  }
});

test('settings registry provides complete render metadata for every control', () => {
  for (const setting of settingsCategories.flatMap((category) => category.settings)) {
    assert.match(setting.key, /^[a-z]+(?:\.[a-zA-Z][\w]*)+$/);
    assert.ok(setting.label && setting.description, `${setting.key} needs user-facing metadata`);
    if (setting.type === 'select') {
      assert.ok(
        Array.isArray(setting.options) && setting.options.length > 0,
        `${setting.key} needs options`,
      );
      assert.ok(
        setting.options.includes(setting.default),
        `${setting.key} default must be selectable`,
      );
    } else if (setting.type === 'range') {
      assert.ok(
        Number.isFinite(setting.min) &&
          Number.isFinite(setting.max) &&
          Number.isFinite(setting.step),
        `${setting.key} needs numeric bounds`,
      );
      assert.ok(
        setting.min <= setting.default && setting.default <= setting.max,
        `${setting.key} default must be bounded`,
      );
    } else if (setting.type === 'action')
      assert.ok(setting.actionLabel, `${setting.key} needs an action label`);
  }
});

test('controller settings options are accepted by the shared policy normalizer', () => {
  const setting = settingsCategories
    .find((category) => category.id === 'controllers')
    .settings.find((item) => item.key === 'controllers.defaultProfile');
  for (const profile of setting.options)
    assert.equal(normalizeControllerPolicy({ defaultProfile: profile }).defaultProfile, profile);
});

test('active setting toggles keep their label beside the thumb', async () => {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  const stylesheet = await readFile(path.join(directory, 'settings.css'), 'utf8');
  assert.match(stylesheet, /\.toggle\s*\{[^}]*min-width:\s*72px/s);
  assert.match(stylesheet, /\.toggle\.is-on\s*\{[^}]*flex-direction:\s*row-reverse/s);
  assert.doesNotMatch(stylesheet, /\.toggle\.is-on span\s*\{[^}]*transform:/s);
});
