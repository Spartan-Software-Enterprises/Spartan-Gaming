import test from 'node:test';
import assert from 'node:assert/strict';
import {applyGlobalProviderPreferences, createProviderProfileStore, normalizeProviderProfile} from './profiles.mjs';

function storage() { const values = new Map(); return {getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value)}; }
test('provider profiles normalize safe launch preferences without secrets', () => { const profile = normalizeProviderProfile({providerId: 'xbox-cloud-gaming', accountLabel: 'Family', region: 'North America', quality: 'prefer-quality', launchMode: 'browser'}); assert.equal(profile.quality, 'prefer-quality'); assert.equal(Object.hasOwn(profile, 'password'), false); });
test('provider profile store saves, exports, imports, and removes profiles', () => { const store = createProviderProfileStore({storage: storage()}); store.save({providerId: 'twitch', accountLabel: 'Creator'}); assert.equal(store.get('twitch').accountLabel, 'Creator'); const exported = store.export(); const other = createProviderProfileStore({storage: storage()}); other.import(exported); assert.equal(other.list().length, 1); other.remove('twitch'); assert.equal(other.list().length, 0); });
test('provider profile import rejects malformed data', () => { assert.throws(() => createProviderProfileStore({storage: storage()}).import('{}'), /invalid/); });
test('provider profiles bound untrusted metadata and exports', () => {
  const profile = normalizeProviderProfile({providerId: 'twitch', accountLabel: 'a'.repeat(200), notes: 'n'.repeat(5000)});
  assert.equal(profile.accountLabel.length, 128);
  assert.equal(profile.notes.length, 4096);
  assert.throws(() => normalizeProviderProfile({providerId: '../unsafe'}), /bounded lowercase identifier/);
  const store = createProviderProfileStore({storage: storage()});
  assert.throws(() => store.import({version: 2, profiles: []}), /invalid/);
  assert.throws(() => store.import({version: 1, profiles: Array.from({length: 51}, (_, index) => ({providerId: `provider-${index}`}))}), /invalid/);
});
test('global provider region fills automatic profiles without overriding explicit regions', () => { assert.equal(applyGlobalProviderPreferences({region: 'automatic'}, {'providers.region': 'Europe'}).region, 'europe'); assert.equal(applyGlobalProviderPreferences({region: 'north-america'}, {'providers.region': 'Europe'}).region, 'north-america'); assert.equal(applyGlobalProviderPreferences({}, {'providers.region': 'Custom'}).region, 'automatic'); });
test('global official-app preference upgrades default browser launches without overriding explicit choices', () => { assert.equal(applyGlobalProviderPreferences({}, {'providers.preferOfficialApps': true}).launchMode, 'official'); assert.equal(applyGlobalProviderPreferences({launchMode: 'native'}, {'providers.preferOfficialApps': true}).launchMode, 'native'); });
test('provider profiles keep embed targets non-secret and bounded', () => { const profile = normalizeProviderProfile({providerId: 'twitch', embedTarget: ' twitchdev ', password: 'secret'}); assert.equal(profile.embedTarget, 'twitchdev'); assert.equal(Object.hasOwn(profile, 'password'), false); assert.ok(profile.embedTarget.length <= 128); });
