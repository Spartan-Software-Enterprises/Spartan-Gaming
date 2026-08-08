export const PROFILE_IDS = Object.freeze(['default', 'gaming', 'family', 'guest']);
export const PROFILE_LABELS = Object.freeze({default: 'Default', gaming: 'Gaming', family: 'Family', guest: 'Guest'});
const SETTINGS_KEY = 'spartan-gaming.settings.v1';

export function normalizeProfileId(value) {
  const id = String(value || '').trim().toLowerCase();
  return PROFILE_IDS.includes(id) ? id : PROFILE_IDS.find(candidate => PROFILE_LABELS[candidate].toLowerCase() === id) || 'gaming';
}

export function readActiveProfileId(storage = globalThis.localStorage) {
  try {
    const settings = JSON.parse(storage?.getItem(SETTINGS_KEY) || '{}');
    return normalizeProfileId(settings['sync.activeProfile']);
  } catch {
    return 'gaming';
  }
}

export function createProfileStorage({storage = globalThis.localStorage, profileId, migrateLegacy = true} = {}) {
  const id = normalizeProfileId(profileId || readActiveProfileId(storage));
  const scopedKey = key => id === 'default' ? key : `spartan-gaming.profile.${id}.${key}`;
  const legacyValue = key => id === 'gaming' && migrateLegacy ? storage?.getItem(key) : null;
  const getItem = key => {
    const scoped = storage?.getItem(scopedKey(key));
    if (scoped !== null && scoped !== undefined) return scoped;
    const legacy = legacyValue(key);
    if (legacy !== null && legacy !== undefined) {
      storage?.setItem(scopedKey(key), legacy);
      return legacy;
    }
    return null;
  };
  return Object.freeze({
    profileId: id,
    getItem,
    setItem(key, value) { storage?.setItem(scopedKey(key), String(value)); },
    removeItem(key) { storage?.removeItem?.(scopedKey(key)); },
    key(index) { return storage?.key?.(index) || null; },
    get length() { return storage?.length || 0; },
  });
}

export function createActiveProfileStorage(options = {}) {
  return createProfileStorage(options);
}
