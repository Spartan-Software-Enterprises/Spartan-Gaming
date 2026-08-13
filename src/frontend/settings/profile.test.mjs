import assert from 'node:assert/strict';
import test from 'node:test';
import { ACTIVE_PROFILE_KEY } from '../profiles/storage.mjs';
import { createSettingsStore, normalizeSettings } from './profile.mjs';

function storage() {
  const values = new Map();
  return {
    setItem: (key, value) => values.set(key, value),
    getItem: (key) => values.get(key),
    removeItem: (key) => values.delete(key),
  };
}

test('settings profile normalization preserves defaults and bounds values', () => {
  const settings = normalizeSettings({
    'streaming.bitrate': 1000,
    'streaming.qualityPreset': 'not-valid',
    'gaming.autoFullscreen': 0,
    'accessibility.colorVision': 'invalid',
  });
  assert.equal(settings['streaming.bitrate'], 100);
  assert.equal(settings['streaming.qualityPreset'], 'Balanced');
  assert.equal(settings['gaming.autoFullscreen'], false);
  assert.equal(settings['accessibility.colorVision'], 'None');
});

test('settings profile normalization preserves valid custom controller profile IDs', () => {
  const settings = normalizeSettings({ 'controllers.defaultProfile': 'custom-living-room' });
  assert.equal(settings['controllers.defaultProfile'], 'custom-living-room');
  assert.equal(
    normalizeSettings({ 'controllers.defaultProfile': 'invalid profile label' })[
      'controllers.defaultProfile'
    ],
    'Auto-detect',
  );
});

test('settings store saves, resets, exports, and imports portable profiles', () => {
  const store = createSettingsStore({ storage: storage() });
  store.save({
    'streaming.bitrate': 40,
    'advanced.customSignalingUrl': 'wss://host.example/session',
  });
  const exported = store.export();
  assert.equal(JSON.parse(exported).settings['streaming.bitrate'], 40);
  store.reset();
  assert.equal(store.read()['streaming.bitrate'], 25);
  store.import(exported);
  assert.equal(store.read()['streaming.bitrate'], 40);
});

test('settings exports omit API keys while retaining non-secret connection preferences', () => {
  const store = createSettingsStore({storage: storage()});
  store.save({'accounts.providerApiKey': 'api-secret', 'accounts.hostApiKey': 'host-secret', 'accounts.hostEndpoint': 'https://host.example'});
  const exported = JSON.parse(store.export());
  assert.equal(exported.settings['accounts.hostEndpoint'], 'https://host.example');
  assert.equal('accounts.providerApiKey' in exported.settings, false);
  assert.equal('accounts.hostApiKey' in exported.settings, false);
});

test('settings store rejects malformed exports and ignores unknown keys', () => {
  const store = createSettingsStore({ storage: storage() });
  assert.throws(() => store.import('{"version":2,"settings":{}}'), /invalid/);
  const values = store.save({ 'not-a-setting': 'secret' });
  assert.equal('not-a-setting' in values, false);
});

test('settings store isolates profile preferences and persists active profile selection', () => {
  const values = storage();
  const gaming = createSettingsStore({ storage: values });
  gaming.save({ 'appearance.theme': 'OLED Black', 'sync.activeProfile': 'Family' });
  assert.equal(values.getItem(ACTIVE_PROFILE_KEY), 'family');

  const family = createSettingsStore({ storage: values });
  assert.equal(family.read()['appearance.theme'], 'Spartan Dark');
  family.save({ 'appearance.theme': 'Spartan Light' });
  const reloadedFamily = createSettingsStore({ storage: values });
  assert.equal(reloadedFamily.read()['appearance.theme'], 'Spartan Light');
  reloadedFamily.reset();
  assert.equal(createSettingsStore({ storage: values }).read()['sync.activeProfile'], 'Family');
  assert.equal(createSettingsStore({ storage: values }).read()['appearance.theme'], 'Spartan Dark');
  const imported = createSettingsStore({ storage: values });
  imported.import(
    JSON.stringify({
      version: 1,
      settings: { 'sync.activeProfile': 'Gaming', 'appearance.theme': 'Spartan Light' },
    }),
  );
  assert.equal(createSettingsStore({ storage: values }).read()['sync.activeProfile'], 'Family');
  assert.equal(
    createSettingsStore({ storage: values }).read()['appearance.theme'],
    'Spartan Light',
  );

  const gamingAgain = createSettingsStore({ storage: values, profileId: 'gaming' });
  assert.equal(gamingAgain.read()['appearance.theme'], 'OLED Black');
  assert.equal(gamingAgain.read()['sync.activeProfile'], 'Gaming');
});

test('settings store migrates the legacy unscoped settings into the active gaming profile', () => {
  const values = storage();
  values.setItem(
    'spartan-gaming.settings.v1',
    JSON.stringify({ 'appearance.theme': 'Spartan Light' }),
  );
  const store = createSettingsStore({ storage: values });
  assert.equal(store.read()['appearance.theme'], 'Spartan Light');
  assert.equal(
    values.getItem('spartan-gaming.profile.gaming.spartan-gaming.settings.v1') !== null,
    true,
  );
});
