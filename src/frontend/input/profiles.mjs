import {DEFAULT_BINDINGS} from './input.mjs';

export const CONTROLLER_PROFILES_KEY = 'spartan-gaming.controller-profiles.v1';
const PROFILE_ID = /^[a-z0-9][a-z0-9._-]{1,63}$/;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function required(value, name) { if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`); return value.trim(); }

export function validateBindings(bindings) {
  if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) throw new TypeError('bindings must be an object');
  const normalized = {};
  const controls = new Set();
  for (const [action, control] of Object.entries(bindings)) {
    required(action, 'action'); const normalizedControl = required(control, `binding for ${action}`);
    if (controls.has(normalizedControl)) throw new Error(`control is already bound: ${normalizedControl}`);
    controls.add(normalizedControl); normalized[action] = normalizedControl;
  }
  return Object.freeze(normalized);
}

export function createControllerProfile({id, name, deviceMatch = 'any', bindings = DEFAULT_BINDINGS, deadzone = 0.12, rumble = true} = {}) {
  const profileId = required(id, 'profile id').toLowerCase(); if (!PROFILE_ID.test(profileId)) throw new TypeError('profile id must use lowercase letters, numbers, dots, underscores, or hyphens');
  const normalizedName = required(name, 'profile name'); const normalizedDeadzone = Math.max(0, Math.min(0.5, Number(deadzone) || 0));
  return Object.freeze({id: profileId, name: normalizedName, deviceMatch: required(deviceMatch, 'deviceMatch'), bindings: validateBindings(bindings), deadzone: normalizedDeadzone, rumble: Boolean(rumble)});
}

export function updateControllerBinding(profile, action, control, {allowDuplicate = false} = {}) {
  const nextBindings = {...profile.bindings, [required(action, 'action')]: required(control, 'control')};
  if (!allowDuplicate) validateBindings(nextBindings);
  return createControllerProfile({...profile, bindings: nextBindings});
}

export function createControllerProfileStore({storage, key = CONTROLLER_PROFILES_KEY} = {}) {
  const memory = new Map(); const backend = storage || {getItem: name => memory.get(name) || null, setItem: (name, value) => memory.set(name, value)};
  function read() { try { const parsed = JSON.parse(backend.getItem(key) || '[]'); return parsed.map(profile => createControllerProfile(profile)); } catch { return []; } }
  function write(profiles) { backend.setItem(key, JSON.stringify(profiles)); }
  return Object.freeze({
    list() { return Object.freeze(read()); },
    get(id) { return read().find(profile => profile.id === id); },
    save(profile) { const normalized = createControllerProfile(profile); const profiles = read().filter(item => item.id !== normalized.id); profiles.push(normalized); write(profiles); return normalized; },
    remove(id) { write(read().filter(profile => profile.id !== id)); },
  });
}

export const BUILTIN_CONTROLLER_PROFILES = Object.freeze([
  createControllerProfile({id: 'xbox-layout', name: 'Xbox layout'}),
  createControllerProfile({id: 'playstation-layout', name: 'PlayStation layout', bindings: {...DEFAULT_BINDINGS, confirm: 'button-1', cancel: 'button-0'}}),
  createControllerProfile({id: 'keyboard-mouse', name: 'Keyboard and mouse', bindings: {confirm: 'key-Enter', cancel: 'key-Escape', menu: 'key-Tab', pause: 'key-P'}}),
]);
