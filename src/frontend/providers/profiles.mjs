export const PROVIDER_PROFILES_KEY = 'spartan-gaming.provider-profiles.v1';
const GLOBAL_REGION_VALUES = Object.freeze({Automatic: 'automatic', 'North America': 'north-america', Europe: 'europe', 'Asia Pacific': 'asia-pacific', 'Latin America': 'latin-america'});

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function required(value, name) { if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`); }
export function normalizeProviderProfile(profile) { required(profile?.providerId, 'profile.providerId'); const region = GLOBAL_REGION_VALUES[profile.region] || (Object.values(GLOBAL_REGION_VALUES).includes(profile.region) ? profile.region : 'automatic'); return Object.freeze({providerId: profile.providerId.trim(), accountLabel: String(profile.accountLabel || ''), region, quality: ['prefer-latency', 'balanced', 'prefer-quality'].includes(profile.quality) ? profile.quality : 'balanced', launchMode: ['browser', 'official', 'native'].includes(profile.launchMode) ? profile.launchMode : 'browser', autoFullscreen: profile.autoFullscreen !== false, embedTarget: String(profile.embedTarget || '').trim().slice(0, 128), notes: String(profile.notes || '')}); }

export function applyGlobalProviderPreferences(profile = {}, settings = {}) {
  const explicitRegion = ['automatic', 'north-america', 'europe', 'asia-pacific', 'latin-america'].includes(profile.region) && profile.region !== 'automatic';
  const globalRegion = GLOBAL_REGION_VALUES[settings['providers.region']] || 'automatic';
  const launchMode = settings['providers.preferOfficialApps'] === true && (!profile.launchMode || profile.launchMode === 'browser') ? 'official' : (profile.launchMode || 'browser');
  return Object.freeze({...profile, region: explicitRegion ? profile.region : globalRegion, launchMode});
}

export function createProviderProfileStore({storage = globalThis.localStorage, key = PROVIDER_PROFILES_KEY} = {}) {
  const backend = storage; const read = () => { try { const parsed = JSON.parse(backend?.getItem(key) || '[]'); return Array.isArray(parsed) ? parsed.map(normalizeProviderProfile) : []; } catch { return []; } }; const write = profiles => backend?.setItem(key, JSON.stringify(profiles.map(clone)));
  return {list() { return read().map(clone); }, get(providerId) { return read().find(profile => profile.providerId === providerId); }, save(profile) { const normalized = normalizeProviderProfile(profile); const profiles = read().filter(item => item.providerId !== normalized.providerId); profiles.push(normalized); write(profiles); return clone(normalized); }, remove(providerId) { write(read().filter(profile => profile.providerId !== providerId)); }, export() { return JSON.stringify({version: 1, profiles: read().map(clone)}, null, 2); }, import(serialized) { const parsed = typeof serialized === 'string' ? JSON.parse(serialized) : serialized; if (!Array.isArray(parsed?.profiles)) throw new TypeError('provider profile export is invalid'); const profiles = parsed.profiles.map(normalizeProviderProfile); write(profiles); return this.list(); }};
}
