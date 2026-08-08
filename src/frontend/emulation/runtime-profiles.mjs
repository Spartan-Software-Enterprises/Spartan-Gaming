export const RUNTIME_PROFILE_KEY = 'spartan-gaming.runtime-profiles.v1';
export const RUNTIME_PROFILE_VERSION = 1;

const KINDS = new Set(['browser-wasm', 'libretro-core', 'native-adapter', 'native-emulator']);
const PLATFORMS = new Set(['any', 'browser', 'win32', 'darwin', 'linux']);
const TRUST_LEVELS = new Set(['signed', 'user-approved', 'unverified']);
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}$/;
const NATIVE_KINDS = new Set(['native-adapter', 'native-emulator']);
const PREFERENCE_KIND = Object.freeze({
  'browser-wasm': new Set(['browser-wasm']),
  'libretro-core': new Set(['libretro-core']),
  'native-adapter': new Set(['native-adapter', 'native-emulator']),
});

function text(value, name, {max = 160} = {}) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new TypeError(`${name} must be a non-empty string of at most ${max} characters`);
  return value.trim();
}

function list(value, name, {allowEmpty = false} = {}) {
  if (!Array.isArray(value) || (!allowEmpty && !value.length) || value.some(item => typeof item !== 'string' || !item.trim() || item.length > 80)) throw new TypeError(`${name} must contain valid strings`);
  return Object.freeze([...new Set(value.map(item => item.trim()))]);
}

function optionalPath(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || value.length > 1024 || /[\u0000\r\n]/.test(value) || /^[a-z]+:\/\//i.test(value)) throw new TypeError('runtime executablePath must be a local path, not a URL or control string');
  return value.trim();
}

function normalizeId(value) {
  const id = text(value, 'runtime.id', {max: 64}).toLowerCase();
  if (!ID_PATTERN.test(id)) throw new TypeError('runtime.id must use lowercase letters, numbers, dot, underscore, or hyphen');
  return id;
}

export function normalizeRuntimeProfile(record = {}) {
  const kind = text(record.kind, 'runtime.kind');
  const platform = text(record.platform || 'any', 'runtime.platform');
  const trust = text(record.trust || 'user-approved', 'runtime.trust');
  if (!KINDS.has(kind)) throw new TypeError(`unsupported runtime kind: ${kind}`);
  if (!PLATFORMS.has(platform)) throw new TypeError(`unsupported runtime platform: ${platform}`);
  if (!TRUST_LEVELS.has(trust)) throw new TypeError(`unsupported runtime trust level: ${trust}`);
  const executablePath = optionalPath(record.executablePath);
  if (NATIVE_KINDS.has(kind) && !executablePath) throw new TypeError('native runtime profiles require an executablePath or adapter package path');
  if (kind === 'browser-wasm' && platform !== 'browser' && platform !== 'any') throw new TypeError('browser-wasm profiles must target browser or any');
  return Object.freeze({
    id: normalizeId(record.id),
    name: text(record.name, 'runtime.name'),
    kind,
    platform,
    version: text(record.version || 'unversioned', 'runtime.version', {max: 80}),
    coreIds: list(record.coreIds || ['*'], 'runtime.coreIds'),
    capabilities: list(record.capabilities || [], 'runtime.capabilities', {allowEmpty: true}),
    trust,
    enabled: record.enabled !== false,
    ...(executablePath ? {executablePath} : {}),
    notes: typeof record.notes === 'string' ? record.notes.trim().slice(0, 500) : '',
  });
}

export function normalizeRuntimeProfiles(value) {
  if (!Array.isArray(value)) throw new TypeError('runtime profiles must be an array');
  const profiles = value.map(normalizeRuntimeProfile);
  const ids = new Set();
  for (const profile of profiles) { if (ids.has(profile.id)) throw new Error(`duplicate runtime profile: ${profile.id}`); ids.add(profile.id); }
  return Object.freeze(profiles);
}

export function createRuntimeProfileStore({storage = globalThis.localStorage, maxEntries = 100} = {}) {
  const limit = Math.max(1, Math.min(500, Number(maxEntries) || 100));
  let profiles = [];
  try {
    const parsed = JSON.parse(storage?.getItem(RUNTIME_PROFILE_KEY) || '[]');
    if (Array.isArray(parsed)) profiles = normalizeRuntimeProfiles(parsed).slice(0, limit);
  } catch { profiles = []; }
  const persist = () => { try { storage?.setItem(RUNTIME_PROFILE_KEY, JSON.stringify(profiles)); } catch { /* Storage is optional in private/restricted contexts. */ } };
  return Object.freeze({
    list() { return profiles.map(profile => Object.freeze({...profile, coreIds: [...profile.coreIds], capabilities: [...profile.capabilities]})); },
    get(id) { const profile = profiles.find(item => item.id === id); return profile ? Object.freeze({...profile, coreIds: [...profile.coreIds], capabilities: [...profile.capabilities]}) : null; },
    save(record) { const next = normalizeRuntimeProfile(record); const index = profiles.findIndex(profile => profile.id === next.id); if (index >= 0) profiles = profiles.with(index, next); else profiles = [...profiles, next].slice(-limit); persist(); return this.get(next.id); },
    remove(id) { profiles = profiles.filter(profile => profile.id !== id); persist(); return this.list(); },
    clear() { profiles = []; persist(); return []; },
    export() { return JSON.stringify({version: RUNTIME_PROFILE_VERSION, profiles}, null, 2); },
    import(value) { const parsed = typeof value === 'string' ? JSON.parse(value) : value; if (parsed?.version !== RUNTIME_PROFILE_VERSION || !Array.isArray(parsed.profiles)) throw new TypeError('runtime profile export version is unsupported'); profiles = normalizeRuntimeProfiles(parsed.profiles).slice(0, limit); persist(); return this.list(); },
  });
}

function platformMatches(profile, platform) { return profile.platform === 'any' || profile.platform === platform; }
function coreMatches(profile, coreId) { return profile.coreIds.includes('*') || profile.coreIds.includes(coreId); }

export function resolveRuntimeProfile({coreId, preference = 'automatic', profiles = [], platform = 'browser', browserReady = false} = {}) {
  const id = text(coreId, 'coreId');
  const normalized = normalizeRuntimeProfiles(profiles);
  const preferredKinds = preference === 'automatic' ? null : PREFERENCE_KIND[preference];
  if (preference !== 'automatic' && !preferredKinds) throw new TypeError(`unsupported runtime preference: ${preference}`);
  const matches = normalized.filter(profile => profile.enabled && profile.trust !== 'unverified' && platformMatches(profile, platform) && coreMatches(profile, id) && (!preferredKinds || preferredKinds.has(profile.kind)));
  const browserProfile = Object.freeze({id: 'spartan-browser-runtime', name: 'Spartan browser runtime', kind: 'browser-wasm', platform: 'browser', version: 'built-in', coreIds: [id], capabilities: ['WebAssembly', 'WebGPU/WebGL'], trust: 'signed', enabled: true, notes: 'Built into the browser frontend; no native executable is launched.'});
  if ((preference === 'automatic' || preference === 'browser-wasm') && browserReady) return Object.freeze({status: 'ready', source: 'built-in', profile: browserProfile, reason: 'browser runtime capability is available'});
  if (matches.length) return Object.freeze({status: 'ready', source: 'profile', profile: matches[0], reason: 'enabled trusted runtime profile matches the core and platform'});
  if (preference === 'browser-wasm') return Object.freeze({status: 'browser-capability-missing', source: 'none', reason: 'browser runtime was requested but required graphics capability is unavailable'});
  if (preference === 'automatic' || preference === 'native-adapter' || preference === 'libretro-core') return Object.freeze({status: 'configuration-required', source: 'none', reason: 'no enabled trusted runtime profile matches this core and platform'});
  return Object.freeze({status: 'unsupported', source: 'none', reason: 'no runtime profile matches this core and platform'});
}

export const runtimeProfileKinds = Object.freeze([...KINDS]);
export const runtimeProfileTrustLevels = Object.freeze([...TRUST_LEVELS]);

