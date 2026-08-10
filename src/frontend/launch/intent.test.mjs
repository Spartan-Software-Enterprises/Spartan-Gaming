import assert from 'node:assert/strict';
import test from 'node:test';
import {clearLaunchIntent, consumeLaunchIntent, createLaunchIntent, readLaunchIntent, saveLaunchIntent} from './intent.mjs';

const entry = {id: 'dolphin', backendType: 'emulator', launchMode: 'native', requirements: ['user-files'], capabilities: ['gamepad']};
const plan = {backendId: 'dolphin', action: 'choose-runtime', mode: 'native', requirements: ['user-files'], capabilities: ['gamepad']};

test('launch intents preserve backend-neutral routing metadata', () => {
  const intent = createLaunchIntent({entry, plan, profileId: 'living-room'});
  assert.deepEqual(intent, {version: 1, backendId: 'dolphin', backendType: 'emulator', mode: 'native', action: 'choose-runtime', url: null, profileId: 'living-room', controllerProfile: null, returnTo: '../dashboard/index.html', requirements: ['user-files'], capabilities: ['gamepad'], createdAt: intent.createdAt});
  assert.equal(Object.isFrozen(intent), true);
});

test('launch intents persist only validated session-scoped data', () => {
  const values = new Map();
  const storage = {setItem: (key, value) => values.set(key, value), getItem: key => values.get(key), removeItem: key => values.delete(key)};
  const saved = saveLaunchIntent(storage, createLaunchIntent({entry, plan}));
  assert.equal(readLaunchIntent(storage).backendId, saved.backendId);
  assert.equal(readLaunchIntent(storage).returnTo, saved.returnTo);
  clearLaunchIntent(storage);
  assert.equal(readLaunchIntent(storage), null);
});

test('launch intents carry a bounded controller profile override', () => { const intent = createLaunchIntent({entry, plan, controllerProfile: 'PlayStation layout'}); assert.equal(intent.controllerProfile, 'PlayStation layout'); assert.throws(() => createLaunchIntent({entry, plan, controllerProfile: 'x'.repeat(81)}), /too long/); });

test('launch intents reject insecure URLs and malformed stored values', () => {
  assert.throws(() => createLaunchIntent({entry: {...entry, backendType: 'provider'}, plan: {...plan, action: 'open-url', url: 'http://example.test'}}), /HTTPS/);
  const storage = {getItem: () => '{bad json'};
  assert.equal(readLaunchIntent(storage), null);
});

test('launch intent consumption is target-aware, one-shot, and age-bounded', () => {
  const values = new Map(); const storage = {setItem: (key, value) => values.set(key, value), getItem: key => values.get(key), removeItem: key => values.delete(key)};
  const createdAt = '2026-08-07T12:00:00.000Z';
  saveLaunchIntent(storage, createLaunchIntent({entry, plan, createdAt}));
  assert.equal(consumeLaunchIntent(storage, {backendType: 'provider', action: 'configure-host', now: Date.parse(createdAt) + 1000}), null);
  assert.equal(readLaunchIntent(storage).backendId, 'dolphin');
  const consumed = consumeLaunchIntent(storage, {backendType: 'emulator', action: 'choose-runtime', now: Date.parse(createdAt) + 1000});
  assert.equal(consumed.backendId, 'dolphin'); assert.equal(readLaunchIntent(storage), null);
  saveLaunchIntent(storage, createLaunchIntent({entry, plan, createdAt}));
  assert.equal(consumeLaunchIntent(storage, {backendType: 'emulator', now: Date.parse(createdAt) + 10 * 60 * 1000 + 1}), null);
  assert.equal(readLaunchIntent(storage), null);
});
