import assert from 'node:assert/strict';
import {ACTIVE_PROFILE_KEY, createActiveProfileStorage, createProfileStorage, readActiveProfileId} from './storage.mjs';

function memoryStorage() {
  const values = new Map();
  return {getItem: key => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key), key: index => [...values.keys()][index] || null, get length() { return values.size; }};
}

const storage = memoryStorage();
storage.setItem('spartan-gaming.settings.v1', JSON.stringify({'sync.activeProfile': 'Family'}));
assert.equal(readActiveProfileId(storage), 'family');
const family = createActiveProfileStorage({storage});
family.setItem('spartan-gaming.providers.v1', 'family-data');
assert.equal(storage.getItem('spartan-gaming.profile.family.spartan-gaming.providers.v1'), 'family-data');
assert.equal(createProfileStorage({storage, profileId: 'guest'}).getItem('spartan-gaming.providers.v1'), null);

storage.setItem('spartan-gaming.launch-history.v1', '["legacy"]');
const gaming = createProfileStorage({storage, profileId: 'gaming'});
assert.equal(gaming.getItem('spartan-gaming.launch-history.v1'), '["legacy"]');
assert.equal(storage.getItem('spartan-gaming.profile.gaming.spartan-gaming.launch-history.v1'), '["legacy"]');

const defaultProfile = createProfileStorage({storage, profileId: 'default'});
defaultProfile.setItem('spartan-gaming.workspaces.v1', 'default-data');
assert.equal(storage.getItem('spartan-gaming.workspaces.v1'), 'default-data');
storage.setItem('spartan-gaming.settings.v1', '{bad json');
assert.equal(readActiveProfileId(storage), 'gaming');
storage.setItem(ACTIVE_PROFILE_KEY, 'Family');
assert.equal(readActiveProfileId(storage), 'family');
