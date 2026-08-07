import test from 'node:test';
import assert from 'node:assert/strict';
import {createProviderProfileStore, normalizeProviderProfile} from './profiles.mjs';

function storage() { const values = new Map(); return {getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value)}; }
test('provider profiles normalize safe launch preferences without secrets', () => { const profile = normalizeProviderProfile({providerId: 'xbox-cloud-gaming', accountLabel: 'Family', region: 'North America', quality: 'prefer-quality', launchMode: 'browser'}); assert.equal(profile.quality, 'prefer-quality'); assert.equal(Object.hasOwn(profile, 'password'), false); });
test('provider profile store saves, exports, imports, and removes profiles', () => { const store = createProviderProfileStore({storage: storage()}); store.save({providerId: 'twitch', accountLabel: 'Creator'}); assert.equal(store.get('twitch').accountLabel, 'Creator'); const exported = store.export(); const other = createProviderProfileStore({storage: storage()}); other.import(exported); assert.equal(other.list().length, 1); other.remove('twitch'); assert.equal(other.list().length, 0); });
test('provider profile import rejects malformed data', () => { assert.throws(() => createProviderProfileStore({storage: storage()}).import('{}'), /invalid/); });
