import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyGlobalProviderPreferences,
  createProviderProfileStore,
  normalizeProviderProfile,
} from './profiles.mjs';

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
}
test('provider profiles normalize safe launch preferences without secrets', () => {
  const profile = normalizeProviderProfile({
    providerId: 'xbox-cloud-gaming',
    accountLabel: 'Family',
    region: 'North America',
    quality: 'prefer-quality',
    launchMode: 'browser',
    controllerProfile: 'PlayStation layout',
  });
  assert.equal(profile.quality, 'prefer-quality');
  assert.equal(profile.controllerProfile, 'PlayStation layout');
  assert.equal(Object.hasOwn(profile, 'password'), false);
});
test('provider profiles reject unsafe controller profile labels', () => {
  assert.equal(
    normalizeProviderProfile({ providerId: 'xbox-cloud-gaming', controllerProfile: 'not valid' })
      .controllerProfile,
    'Auto-detect',
  );
});
test('provider profiles retain safe custom controller profile IDs', () => {
  assert.equal(
    normalizeProviderProfile({ providerId: 'xbox-cloud-gaming', controllerProfile: 'arcade-stick' })
      .controllerProfile,
    'arcade-stick',
  );
  assert.equal(
    normalizeProviderProfile({ providerId: 'xbox-cloud-gaming', controllerProfile: 'not valid' })
      .controllerProfile,
    'Auto-detect',
  );
});
test('provider profile store saves, exports, imports, and removes profiles', () => {
  const store = createProviderProfileStore({ storage: storage() });
  store.save({ providerId: 'twitch', accountLabel: 'Creator' });
  assert.equal(store.get('twitch').accountLabel, 'Creator');
  const exported = store.export();
  const other = createProviderProfileStore({ storage: storage() });
  other.import(exported);
  assert.equal(other.list().length, 1);
  other.remove('twitch');
  assert.equal(other.list().length, 0);
});

test('provider profiles support multiple accounts per provider', () => {
  const store = createProviderProfileStore({ storage: storage() });
  store.save({ providerId: 'xbox-cloud', accountId: 'personal', accountLabel: 'Personal' });
  store.save({ providerId: 'xbox-cloud', accountId: 'work', accountLabel: 'Work' });
  assert.equal(store.list('xbox-cloud').length, 2);
  assert.equal(store.get('xbox-cloud', 'personal').accountLabel, 'Personal');
  assert.equal(store.get('xbox-cloud', 'work').accountLabel, 'Work');
  store.remove('xbox-cloud', 'personal');
  assert.equal(store.list('xbox-cloud').length, 1);
  assert.equal(store.get('xbox-cloud', 'personal'), null);
  assert.equal(store.get('xbox-cloud', 'work').accountLabel, 'Work');
  store.remove('xbox-cloud');
  assert.equal(store.list('xbox-cloud').length, 0);
});

test('provider profile store defaults accountId to default for backward compatibility', () => {
  const store = createProviderProfileStore({ storage: storage() });
  store.save({ providerId: 'geforce-now', accountLabel: 'Free tier' });
  const profile = store.get('geforce-now');
  assert.equal(profile.accountId, 'default');
  assert.equal(store.get('geforce-now', 'default').accountLabel, 'Free tier');
});

test('provider profile store returns default account when no accountId specified', () => {
  const store = createProviderProfileStore({ storage: storage() });
  store.save({ providerId: 'xbox-cloud', accountId: 'personal', accountLabel: 'Personal' });
  store.save({ providerId: 'xbox-cloud', accountId: 'default', accountLabel: 'Default' });
  assert.equal(store.get('xbox-cloud').accountLabel, 'Default');
  assert.equal(store.get('xbox-cloud', 'personal').accountLabel, 'Personal');
});
test('provider profile import rejects malformed data', () => {
  assert.throws(() => createProviderProfileStore({ storage: storage() }).import('{}'), /invalid/);
});
test('global provider region fills automatic profiles without overriding explicit regions', () => {
  assert.equal(
    applyGlobalProviderPreferences({ region: 'automatic' }, { 'providers.region': 'Europe' })
      .region,
    'europe',
  );
  assert.equal(
    applyGlobalProviderPreferences({ region: 'north-america' }, { 'providers.region': 'Europe' })
      .region,
    'north-america',
  );
  assert.equal(
    applyGlobalProviderPreferences({}, { 'providers.region': 'Custom' }).region,
    'automatic',
  );
});
test('global official-app preference upgrades default browser launches without overriding explicit choices', () => {
  assert.equal(
    applyGlobalProviderPreferences({}, { 'providers.preferOfficialApps': true }).launchMode,
    'official',
  );
  assert.equal(
    applyGlobalProviderPreferences(
      { launchMode: 'native' },
      { 'providers.preferOfficialApps': true },
    ).launchMode,
    'native',
  );
});
test('provider profiles keep embed targets non-secret and bounded', () => {
  const profile = normalizeProviderProfile({
    providerId: 'twitch',
    embedTarget: ' twitchdev ',
    password: 'secret',
  });
  assert.equal(profile.embedTarget, 'twitchdev');
  assert.equal(Object.hasOwn(profile, 'password'), false);
  assert.ok(profile.embedTarget.length <= 128);
});
test('provider profiles bound untrusted metadata and exports', () => {
  const profile = normalizeProviderProfile({
    providerId: 'twitch',
    accountLabel: 'a'.repeat(200),
    notes: 'n'.repeat(5000),
  });
  assert.equal(profile.accountLabel.length, 128);
  assert.equal(profile.notes.length, 4096);
  assert.throws(
    () => normalizeProviderProfile({ providerId: '../unsafe' }),
    /bounded lowercase identifier/,
  );
  const store = createProviderProfileStore({ storage: storage() });
  assert.throws(() => store.import({ version: 2, profiles: [] }), /invalid/);
  assert.throws(
    () =>
      store.import({
        version: 1,
        profiles: Array.from({ length: 51 }, (_, index) => ({ providerId: `provider-${index}` })),
      }),
    /invalid/,
  );
});
