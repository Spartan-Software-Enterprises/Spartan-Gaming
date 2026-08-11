import { defaultSettings, settingsCategories } from './settings-data.mjs';
import {
  ACTIVE_PROFILE_KEY,
  createProfileStorage,
  normalizeProfileId,
  readActiveProfileId,
} from '../profiles/storage.mjs';

export const SETTINGS_KEY = 'spartan-gaming.settings.v1';
export const SETTINGS_EXPORT_VERSION = 1;

const definitions = new Map(
  settingsCategories
    .flatMap((category) => category.settings)
    .filter((setting) => setting.type !== 'action')
    .map((setting) => [setting.key, setting]),
);

function normalizeValue(setting, value) {
  if (setting.type === 'toggle') return Boolean(value);
  if (setting.type === 'range') {
    const number = Number(value);
    return Number.isFinite(number)
      ? Math.min(setting.max, Math.max(setting.min, number))
      : setting.default;
  }
  if (setting.type === 'select')
    return setting.options.includes(value) || setting.accepts?.(value) ? value : setting.default;
  if (setting.type === 'text')
    return typeof value === 'string' ? value.slice(0, 2048) : setting.default;
  return setting.default;
}

export function normalizeSettings(values = {}) {
  return Object.freeze(
    Object.fromEntries(
      [...definitions.keys()].map((key) => [
        key,
        normalizeValue(definitions.get(key), values[key] ?? defaultSettings[key]),
      ]),
    ),
  );
}

export function createSettingsStore({
  storage = globalThis.localStorage,
  key = SETTINGS_KEY,
  profileId,
  scopeProfile = true,
} = {}) {
  const activeProfileId = normalizeProfileId(profileId || readActiveProfileId(storage));
  const profileStorage = scopeProfile
    ? createProfileStorage({ storage, profileId: activeProfileId })
    : storage;
  const settingStorage = profileStorage || storage;
  const activeProfileLabel =
    activeProfileId === 'default'
      ? 'Default'
      : activeProfileId[0].toUpperCase() + activeProfileId.slice(1);
  const read = () => {
    try {
      const values = JSON.parse(settingStorage?.getItem(key) || '{}');
      return Object.freeze({
        ...normalizeSettings(values),
        'sync.activeProfile': activeProfileLabel,
      });
    } catch {
      return normalizeSettings({ 'sync.activeProfile': activeProfileLabel });
    }
  };
  const write = (values, { allowProfileSwitch = true } = {}) => {
    const normalized = normalizeSettings(values);
    const nextProfileId = allowProfileSwitch
      ? normalizeProfileId(normalized['sync.activeProfile'])
      : activeProfileId;
    const nextProfileLabel =
      nextProfileId === 'default'
        ? 'Default'
        : nextProfileId[0].toUpperCase() + nextProfileId.slice(1);
    const persisted = Object.freeze({ ...normalized, 'sync.activeProfile': nextProfileLabel });
    settingStorage?.setItem(key, JSON.stringify(persisted));
    if (scopeProfile && nextProfileId !== activeProfileId)
      storage?.setItem(ACTIVE_PROFILE_KEY, nextProfileId);
    return persisted;
  };
  return Object.freeze({
    read,
    save(values) {
      return write({ ...read(), ...values });
    },
    reset() {
      return write(defaultSettings, { allowProfileSwitch: false });
    },
    export() {
      return JSON.stringify(
        {
          version: SETTINGS_EXPORT_VERSION,
          exportedAt: new Date().toISOString(),
          settings: read(),
        },
        null,
        2,
      );
    },
    import(serialized) {
      const parsed = typeof serialized === 'string' ? JSON.parse(serialized) : serialized;
      if (
        !parsed ||
        parsed.version !== SETTINGS_EXPORT_VERSION ||
        !parsed.settings ||
        typeof parsed.settings !== 'object'
      )
        throw new TypeError('settings export is invalid');
      return write(
        { ...parsed.settings, 'sync.activeProfile': activeProfileLabel },
        { allowProfileSwitch: false },
      );
    },
  });
}
