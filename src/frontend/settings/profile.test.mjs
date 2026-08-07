import assert from 'node:assert/strict';
import test from 'node:test';
import {createSettingsStore, normalizeSettings} from './profile.mjs';

function storage() { const values = new Map(); return {setItem: (key, value) => values.set(key, value), getItem: key => values.get(key), removeItem: key => values.delete(key)}; }

test('settings profile normalization preserves defaults and bounds values', () => {
  const settings = normalizeSettings({'streaming.bitrate': 1000, 'streaming.qualityPreset': 'not-valid', 'gaming.autoFullscreen': 0});
  assert.equal(settings['streaming.bitrate'], 100);
  assert.equal(settings['streaming.qualityPreset'], 'Balanced');
  assert.equal(settings['gaming.autoFullscreen'], false);
});

test('settings store saves, resets, exports, and imports portable profiles', () => {
  const store = createSettingsStore({storage: storage()});
  store.save({'streaming.bitrate': 40, 'advanced.customSignalingUrl': 'wss://host.example/session'});
  const exported = store.export();
  assert.equal(JSON.parse(exported).settings['streaming.bitrate'], 40);
  store.reset();
  assert.equal(store.read()['streaming.bitrate'], 25);
  store.import(exported);
  assert.equal(store.read()['streaming.bitrate'], 40);
});

test('settings store rejects malformed exports and ignores unknown keys', () => {
  const store = createSettingsStore({storage: storage()});
  assert.throws(() => store.import('{"version":2,"settings":{}}'), /invalid/);
  const values = store.save({'not-a-setting': 'secret'});
  assert.equal('not-a-setting' in values, false);
});
