import {defaultSettings, settingsCategories} from './settings-data.mjs';

export const SETTINGS_KEY = 'spartan-gaming.settings.v1';
export const SETTINGS_EXPORT_VERSION = 1;

const definitions = new Map(settingsCategories.flatMap(category => category.settings).filter(setting => setting.type !== 'action').map(setting => [setting.key, setting]));

function normalizeValue(setting, value) {
  if (setting.type === 'toggle') return Boolean(value);
  if (setting.type === 'range') {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(setting.max, Math.max(setting.min, number)) : setting.default;
  }
  if (setting.type === 'select') return setting.options.includes(value) ? value : setting.default;
  if (setting.type === 'text') return typeof value === 'string' ? value.slice(0, 2048) : setting.default;
  return setting.default;
}

export function normalizeSettings(values = {}) {
  return Object.freeze(Object.fromEntries(definitions.keys().map(key => [key, normalizeValue(definitions.get(key), values[key] ?? defaultSettings[key])] )));
}

export function createSettingsStore({storage = globalThis.localStorage, key = SETTINGS_KEY} = {}) {
  const read = () => {
    try { return normalizeSettings(JSON.parse(storage?.getItem(key) || '{}')); } catch { return normalizeSettings(); }
  };
  const write = values => { const normalized = normalizeSettings(values); storage?.setItem(key, JSON.stringify(normalized)); return normalized; };
  return Object.freeze({
    read,
    save(values) { return write({...read(), ...values}); },
    reset() { return write(defaultSettings); },
    export() { return JSON.stringify({version: SETTINGS_EXPORT_VERSION, exportedAt: new Date().toISOString(), settings: read()}, null, 2); },
    import(serialized) {
      const parsed = typeof serialized === 'string' ? JSON.parse(serialized) : serialized;
      if (!parsed || parsed.version !== SETTINGS_EXPORT_VERSION || !parsed.settings || typeof parsed.settings !== 'object') throw new TypeError('settings export is invalid');
      return write(parsed.settings);
    },
  });
}
