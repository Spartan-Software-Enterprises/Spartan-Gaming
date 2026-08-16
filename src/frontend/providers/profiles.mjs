export const PROVIDER_PROFILES_KEY = 'spartan-gaming.provider-profiles.v1';
export const PROVIDER_PROFILE_EXPORT_VERSION = 1;
const GLOBAL_REGION_VALUES = Object.freeze({
  Automatic: 'automatic',
  'North America': 'north-america',
  Europe: 'europe',
  'Asia Pacific': 'asia-pacific',
  'Latin America': 'latin-america',
});
const CONTROLLER_PROFILE_VALUES = new Set([
  'Auto-detect',
  'Xbox layout',
  'PlayStation layout',
  'Nintendo layout',
  'Keyboard and mouse',
]);
const CONTROLLER_PROFILE_ID = /^[a-z0-9][a-z0-9._-]{1,63}$/;
const MAX_PROFILES = 50;
const MAX_PROVIDER_ID_LENGTH = 64;
const MAX_ACCOUNT_LABEL_LENGTH = 128;
const MAX_NOTES_LENGTH = 4096;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
function required(value, name) {
  if (typeof value !== 'string' || !value.trim())
    throw new TypeError(`${name} must be a non-empty string`);
}
function text(value, limit) {
  return String(value || '')
    .trim()
    .slice(0, limit);
}
export function normalizeProviderProfile(profile) {
  required(profile?.providerId, 'profile.providerId');
  const providerId = profile.providerId.trim();
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(providerId) || providerId.length > MAX_PROVIDER_ID_LENGTH)
    throw new TypeError('profile.providerId must be a bounded lowercase identifier');
  const accountId =
    typeof profile.accountId === 'string' && profile.accountId.trim()
      ? profile.accountId.trim()
      : 'default';
  const region =
    GLOBAL_REGION_VALUES[profile.region] ||
    (Object.values(GLOBAL_REGION_VALUES).includes(profile.region) ? profile.region : 'automatic');
  const requestedControllerProfile =
    typeof profile.controllerProfile === 'string' ? profile.controllerProfile.trim() : '';
  const controllerProfile =
    CONTROLLER_PROFILE_VALUES.has(requestedControllerProfile) ||
    CONTROLLER_PROFILE_ID.test(requestedControllerProfile)
      ? requestedControllerProfile
      : 'Auto-detect';
  return Object.freeze({
    providerId,
    accountId,
    accountLabel: text(profile.accountLabel, MAX_ACCOUNT_LABEL_LENGTH),
    region,
    quality: ['prefer-latency', 'balanced', 'prefer-quality'].includes(profile.quality)
      ? profile.quality
      : 'balanced',
    launchMode: ['browser', 'official', 'native'].includes(profile.launchMode)
      ? profile.launchMode
      : 'browser',
    controllerProfile,
    autoFullscreen: profile.autoFullscreen !== false,
    embedTarget: text(profile.embedTarget, 128),
    notes: text(profile.notes, MAX_NOTES_LENGTH),
  });
}

/** Composite storage key for multi-account profiles. */
function profileKey(providerId, accountId) {
  return `${providerId}::${accountId}`;
}

export function applyGlobalProviderPreferences(profile = {}, settings = {}) {
  const explicitRegion =
    ['automatic', 'north-america', 'europe', 'asia-pacific', 'latin-america'].includes(
      profile.region,
    ) && profile.region !== 'automatic';
  const globalRegion = GLOBAL_REGION_VALUES[settings['providers.region']] || 'automatic';
  const launchMode =
    settings['providers.preferOfficialApps'] === true &&
    (!profile.launchMode || profile.launchMode === 'browser')
      ? 'official'
      : profile.launchMode || 'browser';
  return Object.freeze({
    ...profile,
    region: explicitRegion ? profile.region : globalRegion,
    launchMode,
  });
}

export function createProviderProfileStore({
  storage = globalThis.localStorage,
  key = PROVIDER_PROFILES_KEY,
} = {}) {
  const backend = storage;
  const read = () => {
    try {
      const parsed = JSON.parse(backend?.getItem(key) || '[]');
      return Array.isArray(parsed)
        ? parsed.map(normalizeProviderProfile).slice(0, MAX_PROFILES)
        : [];
    } catch {
      return [];
    }
  };
  const write = (profiles) => backend?.setItem(key, JSON.stringify(profiles.map(clone)));
  return {
    list(providerId) {
      const profiles = read().map(clone);
      return providerId
        ? profiles.filter((profile) => profile.providerId === providerId)
        : profiles;
    },
    get(providerId, accountId) {
      const profiles = read();
      if (accountId) {
        const match = profiles.find(
          (profile) => profile.providerId === providerId && profile.accountId === accountId,
        );
        return match ? clone(match) : null;
      }
      const match =
        profiles.find(
          (profile) => profile.providerId === providerId && profile.accountId === 'default',
        ) || profiles.find((profile) => profile.providerId === providerId);
      return match ? clone(match) : null;
    },
    save(profile) {
      const normalized = normalizeProviderProfile(profile);
      const profiles = read().filter(
        (item) =>
          !(item.providerId === normalized.providerId && item.accountId === normalized.accountId),
      );
      if (profiles.length >= MAX_PROFILES)
        throw new Error(`provider profile limit of ${MAX_PROFILES} reached`);
      profiles.push(normalized);
      write(profiles);
      return clone(normalized);
    },
    remove(providerId, accountId) {
      if (accountId) {
        write(
          read().filter(
            (item) => !(item.providerId === providerId && item.accountId === accountId),
          ),
        );
      } else {
        write(read().filter((item) => item.providerId !== providerId));
      }
    },
    export() {
      return JSON.stringify(
        { version: PROVIDER_PROFILE_EXPORT_VERSION, profiles: read().map(clone) },
        null,
        2,
      );
    },
    import(serialized) {
      const parsed = typeof serialized === 'string' ? JSON.parse(serialized) : serialized;
      if (
        parsed?.version !== PROVIDER_PROFILE_EXPORT_VERSION ||
        !Array.isArray(parsed.profiles) ||
        parsed.profiles.length > MAX_PROFILES
      )
        throw new TypeError('provider profile export is invalid');
      const profiles = parsed.profiles.map(normalizeProviderProfile);
      const keys = profiles.map((profile) => profileKey(profile.providerId, profile.accountId));
      if (new Set(keys).size !== profiles.length)
        throw new TypeError('provider profile export contains duplicate provider IDs');
      write(profiles);
      return this.list();
    },
  };
}
