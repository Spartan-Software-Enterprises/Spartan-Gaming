import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { defaultSettings, settingsCategories } from './settings-data.mjs';
import { normalizeControllerPolicy } from '../input/controller-policy.mjs';
import './control.test.mjs';

function extractCssBlock(stylesheet, marker) {
  const markerIndex = stylesheet.indexOf(marker);
  assert.notEqual(markerIndex, -1, `${marker} is missing`);
  const openIndex = stylesheet.indexOf('{', markerIndex + marker.length);
  assert.notEqual(openIndex, -1, `${marker} has no block`);
  let depth = 0;
  for (let index = openIndex; index < stylesheet.length; index += 1) {
    if (stylesheet[index] === '{') depth += 1;
    if (stylesheet[index] === '}') depth -= 1;
    if (depth === 0) return stylesheet.slice(openIndex + 1, index);
  }
  assert.fail(`${marker} block is not closed`);
}

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

test('noise suppression profile setting covers every option with a label', () => {
  const setting = settingsCategories
    .flatMap((category) => category.settings)
    .find((item) => item.key === 'media.micNoiseSuppressionProfile');
  assert.equal(setting.type, 'select');
  assert.deepEqual(setting.options, ['off', 'basic', 'aggressive', 'ml']);
  assert.equal(setting.default, 'basic');
  for (const option of setting.options)
    assert.ok(setting.optionLabels?.[option], `missing label for ${option}`);
});

test('active setting toggles keep their label beside the thumb', async () => {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  const stylesheet = await readFile(path.join(directory, 'settings.css'), 'utf8');
  assert.match(stylesheet, /\.toggle\s*\{[^}]*min-width:\s*72px/s);
  assert.match(stylesheet, /\.toggle\.is-on\s*\{[^}]*flex-direction:\s*row-reverse/s);
  assert.doesNotMatch(stylesheet, /\.toggle\.is-on span\s*\{[^}]*transform:/s);
});

test('mobile settings contain the scrollable category rail inside the viewport', async () => {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  const stylesheet = await readFile(path.join(directory, 'settings.css'), 'utf8');
  const mobileStyles = extractCssBlock(stylesheet, '@media (max-width: 720px)');
  assert.match(mobileStyles, /\.nav\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(mobileStyles, /\.rail\s*\{[^}]*max-width:\s*100vw[^}]*overflow-x:\s*hidden/s);
  assert.match(
    mobileStyles,
    /\.save-status\s*\{[^}]*white-space:\s*normal[^}]*overflow-wrap:\s*anywhere/s,
  );
});

test('updater status owns the Updates save area during asynchronous checks', async () => {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  const implementation = (await readFile(path.join(directory, 'settings.mjs'), 'utf8')).replace(
    /\r\n/g,
    '\n',
  );
  assert.match(implementation, /function updateStatusOwnsSaveArea\(\)/);
  assert.match(implementation, /displayUpdateStatus\(\{ status: 'checking' \}\)/);
  assert.match(implementation, /displayUpdateStatus\(result\)/);
  assert.match(
    implementation,
    /saveSequence !== runtimeSaveSequence \|\| updateStatusOwnsSaveArea\(\)/,
  );
});

test('settings category changes reset the page scroll position', async () => {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  const implementation = (await readFile(path.join(directory, 'settings.mjs'), 'utf8')).replace(
    /\r\n/g,
    '\n',
  );
  assert.match(implementation, /function scrollSettingsToTop\(\)/);
  assert.match(implementation, /globalThis\.scrollTo\?\.\(0, 0\)/);
  assert.match(implementation, /document\.querySelector\('\.main'\)\?\.scrollTo\?\.\(0, 0\)/);
  assert.match(implementation, /render\(\);\n\s*scrollSettingsToTop\(\);/);
});

test('settings update checks do not require Electron', async () => {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  const implementation = (await readFile(path.join(directory, 'settings.mjs'), 'utf8')).replace(
    /\r\n/g,
    '\n',
  );
  assert.match(implementation, /globalThis\.SpartanAndroid/);
  assert.match(
    implementation,
    /api\.github\.com\/repos\/Spartan-Software-Enterprises\/Spartan-Gaming\/releases/,
  );
  assert.doesNotMatch(implementation, /Update checks require the Electron desktop app/);
});
