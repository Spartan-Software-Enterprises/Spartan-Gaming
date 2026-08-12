import { DEFAULT_BINDINGS } from './input.mjs';

export const CONTROLLER_PROFILES_KEY = 'spartan-gaming.controller-profiles.v1';
export const CONTROLLER_PROFILE_VERSION = 1;
const PROFILE_ID = /^[a-z0-9][a-z0-9._-]{1,63}$/;
const PROFILE_CAPABILITIES = new Set([
  'adaptiveTriggers',
  'backButtons',
  'battery',
  'capture',
  'controllerNavigation',
  'gyro',
  'haptics',
  'motion',
  'paddles',
  'pedals',
  'splitInput',
  'textEntry',
  'throttle',
  'touchpad',
  'trackpads',
  'touchscreen',
  'wheel',
]);
export const CONTROLLER_PROFILE_CAPABILITIES = Object.freeze([...PROFILE_CAPABILITIES]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
function required(value, name) {
  if (typeof value !== 'string' || !value.trim())
    throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}
function normalizeCapabilities(value) {
  const values = Array.isArray(value) ? value : [];
  return Object.freeze(
    [
      ...new Set(
        values.filter((item) => typeof item === 'string' && PROFILE_CAPABILITIES.has(item)),
      ),
    ].slice(0, 16),
  );
}

export function validateBindings(bindings) {
  if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings))
    throw new TypeError('bindings must be an object');
  const normalized = {};
  const controls = new Set();
  for (const [action, control] of Object.entries(bindings)) {
    required(action, 'action');
    const normalizedControl = required(control, `binding for ${action}`);
    if (controls.has(normalizedControl))
      throw new Error(`control is already bound: ${normalizedControl}`);
    controls.add(normalizedControl);
    normalized[action] = normalizedControl;
  }
  return Object.freeze(normalized);
}

export function createControllerProfile({
  id,
  name,
  deviceMatch = 'any',
  bindings = DEFAULT_BINDINGS,
  deadzone = 0.12,
  rumble = true,
  capabilities = [],
} = {}) {
  const profileId = required(id, 'profile id').toLowerCase();
  if (!PROFILE_ID.test(profileId))
    throw new TypeError(
      'profile id must use lowercase letters, numbers, dots, underscores, or hyphens',
    );
  const normalizedName = required(name, 'profile name');
  const normalizedDeadzone = Math.max(0, Math.min(0.5, Number(deadzone) || 0));
  return Object.freeze({
    id: profileId,
    name: normalizedName,
    deviceMatch: required(deviceMatch, 'deviceMatch'),
    bindings: validateBindings(bindings),
    deadzone: normalizedDeadzone,
    rumble: Boolean(rumble),
    capabilities: normalizeCapabilities(capabilities),
  });
}

export function updateControllerBinding(profile, action, control, { allowDuplicate = false } = {}) {
  const nextBindings = {
    ...profile.bindings,
    [required(action, 'action')]: required(control, 'control'),
  };
  if (!allowDuplicate) validateBindings(nextBindings);
  return createControllerProfile({ ...profile, bindings: nextBindings });
}

export function createControllerProfileStore({ storage, key = CONTROLLER_PROFILES_KEY } = {}) {
  const memory = new Map();
  const backend = storage || {
    getItem: (name) => memory.get(name) || null,
    setItem: (name, value) => memory.set(name, value),
  };
  function read() {
    try {
      const parsed = JSON.parse(backend.getItem(key) || '[]');
      return parsed.map((profile) => createControllerProfile(profile));
    } catch {
      return [];
    }
  }
  function write(profiles) {
    backend.setItem(key, JSON.stringify(profiles));
  }
  return Object.freeze({
    list() {
      return Object.freeze(read());
    },
    get(id) {
      return read().find((profile) => profile.id === id);
    },
    save(profile) {
      const normalized = createControllerProfile(profile);
      const profiles = read().filter((item) => item.id !== normalized.id);
      profiles.push(normalized);
      write(profiles);
      return normalized;
    },
    remove(id) {
      write(read().filter((profile) => profile.id !== id));
    },
    export() {
      return JSON.stringify({ version: CONTROLLER_PROFILE_VERSION, profiles: read() }, null, 2);
    },
    import(value) {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      if (parsed?.version !== CONTROLLER_PROFILE_VERSION || !Array.isArray(parsed.profiles))
        throw new TypeError('controller profile export version is unsupported');
      const normalized = parsed.profiles.map(createControllerProfile);
      const ids = new Set();
      for (const profile of normalized) {
        if (ids.has(profile.id)) throw new Error(`duplicate controller profile: ${profile.id}`);
        ids.add(profile.id);
      }
      write(normalized);
      return Object.freeze(normalized);
    },
  });
}

export const BUILTIN_CONTROLLER_PROFILES = Object.freeze([
  createControllerProfile({
    id: 'xbox-elite-layout',
    name: 'Xbox Elite / Elite 2',
    deviceMatch: 'Xbox.*Elite',
    bindings: {
      ...DEFAULT_BINDINGS,
      share: 'button-10',
      leftPaddle: 'button-11',
      rightPaddle: 'button-12',
      leftPaddle2: 'button-13',
      rightPaddle2: 'button-14',
    },
    capabilities: ['paddles', 'haptics', 'battery'],
  }),
  createControllerProfile({
    id: 'xbox-adaptive-layout',
    name: 'Xbox Adaptive Controller',
    deviceMatch: 'Xbox Adaptive',
    bindings: { ...DEFAULT_BINDINGS, profile: 'button-10', menu: 'button-11' },
    capabilities: ['haptics', 'battery', 'splitInput'],
  }),
  createControllerProfile({
    id: 'dualsense-layout',
    name: 'DualSense / DualShock',
    deviceMatch: 'Sony Wireless Controller',
    bindings: {
      ...DEFAULT_BINDINGS,
      confirm: 'button-1',
      cancel: 'button-0',
      touchpad: 'button-13',
      create: 'button-10',
      options: 'button-11',
      mic: 'button-14',
    },
    capabilities: ['touchpad', 'gyro', 'adaptiveTriggers', 'haptics', 'battery'],
  }),
  createControllerProfile({
    id: 'dualsense-edge-layout',
    name: 'DualSense Edge',
    deviceMatch: 'DualSense Edge',
    bindings: {
      ...DEFAULT_BINDINGS,
      confirm: 'button-1',
      cancel: 'button-0',
      touchpad: 'button-13',
      create: 'button-10',
      options: 'button-11',
      mic: 'button-14',
      leftPaddle: 'button-15',
      rightPaddle: 'button-16',
    },
    capabilities: ['touchpad', 'gyro', 'adaptiveTriggers', 'haptics', 'battery', 'paddles'],
  }),
  createControllerProfile({
    id: 'playstation-portal-layout',
    name: 'PlayStation Portal',
    deviceMatch: 'PlayStation Portal',
    bindings: {
      ...DEFAULT_BINDINGS,
      confirm: 'button-1',
      cancel: 'button-0',
      touchpad: 'button-13',
    },
    capabilities: ['touchpad', 'haptics', 'battery'],
  }),
  createControllerProfile({
    id: 'joy-con-layout',
    name: 'Joy-Con pair',
    deviceMatch: 'Joy-Con',
    bindings: {
      ...DEFAULT_BINDINGS,
      confirm: 'button-1',
      cancel: 'button-0',
      capture: 'button-13',
      home: 'button-12',
    },
    capabilities: ['gyro', 'motion', 'haptics', 'battery', 'splitInput'],
  }),
  createControllerProfile({
    id: 'switch-pro-layout',
    name: 'Switch Pro Controller',
    deviceMatch: 'Nintendo Switch Pro',
    bindings: {
      ...DEFAULT_BINDINGS,
      confirm: 'button-1',
      cancel: 'button-0',
      capture: 'button-13',
    },
    capabilities: ['gyro', 'motion', 'haptics', 'battery'],
  }),
  createControllerProfile({
    id: 'wii-u-pro-layout',
    name: 'Nintendo Wii U Pro Controller',
    deviceMatch: 'Wii U Pro|WUP',
    bindings: { ...DEFAULT_BINDINGS, confirm: 'button-1', cancel: 'button-0' },
    capabilities: ['haptics', 'battery'],
  }),
  createControllerProfile({
    id: 'steam-deck-layout',
    name: 'Steam Deck',
    deviceMatch: 'Steam Deck',
    bindings: {
      ...DEFAULT_BINDINGS,
      menu: 'button-9',
      view: 'button-10',
      leftPaddle: 'button-13',
      rightPaddle: 'button-14',
      touchpadLeft: 'button-15',
    },
    capabilities: [
      'touchpad',
      'trackpads',
      'gyro',
      'motion',
      'backButtons',
      'touchscreen',
      'textEntry',
      'controllerNavigation',
      'haptics',
      'battery',
    ],
  }),
  createControllerProfile({
    id: 'steam-controller-layout',
    name: 'Steam Controller',
    deviceMatch: 'Steam Controller',
    bindings: {
      ...DEFAULT_BINDINGS,
      leftPadClick: 'button-10',
      rightPadClick: 'button-11',
      gripLeft: 'button-12',
      gripRight: 'button-13',
      menu: 'button-14',
    },
    capabilities: ['trackpads', 'gyro', 'haptics', 'battery'],
  }),
  createControllerProfile({
    id: 'stadia-layout',
    name: 'Stadia controller',
    deviceMatch: 'Stadia',
    bindings: { ...DEFAULT_BINDINGS, assistant: 'button-10', capture: 'button-11' },
  }),
  createControllerProfile({
    id: 'eightbitdo-layout',
    name: '8BitDo / XInput',
    deviceMatch: '8BitDo',
    bindings: { ...DEFAULT_BINDINGS },
  }),
  createControllerProfile({
    id: 'mobile-controller-layout',
    name: 'Backbone / Razer Kishi',
    deviceMatch: 'Backbone|Kishi',
    bindings: { ...DEFAULT_BINDINGS },
  }),
  createControllerProfile({
    id: 'arcade-layout',
    name: 'Arcade stick',
    deviceMatch: 'arcade',
    bindings: {
      confirm: 'button-0',
      cancel: 'button-1',
      menu: 'button-7',
      pause: 'button-6',
      moveUp: 'axis-1-negative',
      moveDown: 'axis-1-positive',
      moveLeft: 'axis-0-negative',
      moveRight: 'axis-0-positive',
    },
  }),
  createControllerProfile({
    id: 'racing-wheel-layout',
    name: 'Racing wheel and pedals',
    deviceMatch: 'wheel',
    bindings: {
      accelerate: 'axis-2-positive',
      brake: 'axis-3-positive',
      steer: 'axis-0',
      clutch: 'axis-4-positive',
      handbrake: 'button-0',
      pause: 'button-9',
    },
    capabilities: ['wheel', 'pedals', 'haptics'],
  }),
  createControllerProfile({
    id: 'logitech-wheel-layout',
    name: 'Logitech racing wheel',
    deviceMatch: 'Logitech.*G(29|920|923)|Logitech Racing',
    bindings: {
      accelerate: 'axis-2-positive',
      brake: 'axis-3-positive',
      steer: 'axis-0',
      clutch: 'axis-4-positive',
      handbrake: 'button-0',
      pause: 'button-9',
    },
    capabilities: ['wheel', 'pedals', 'haptics'],
  }),
  createControllerProfile({
    id: 'thrustmaster-wheel-layout',
    name: 'Thrustmaster racing wheel',
    deviceMatch: 'Thrustmaster.*(T150|T300|TX|TS)|Thrustmaster',
    bindings: {
      accelerate: 'axis-2-positive',
      brake: 'axis-3-positive',
      steer: 'axis-0',
      clutch: 'axis-4-positive',
      handbrake: 'button-0',
      pause: 'button-9',
    },
    capabilities: ['wheel', 'pedals', 'haptics'],
  }),
  createControllerProfile({
    id: 'flight-stick-layout',
    name: 'Flight stick and throttle',
    deviceMatch: 'flight',
    bindings: {
      pitch: 'axis-1',
      roll: 'axis-0',
      yaw: 'axis-2',
      throttle: 'axis-3',
      fire: 'button-0',
      pause: 'button-9',
    },
    capabilities: ['throttle', 'haptics'],
  }),
  createControllerProfile({
    id: 'hotas-layout',
    name: 'HOTAS flight stick',
    deviceMatch: 'HOTAS|VKB|Winwing|Thrustmaster.*(T.Flight|HOTAS)',
    bindings: {
      pitch: 'axis-1',
      roll: 'axis-0',
      yaw: 'axis-2',
      throttle: 'axis-3',
      fire: 'button-0',
      pause: 'button-9',
    },
    capabilities: ['throttle', 'haptics'],
  }),
  createControllerProfile({
    id: 'generic-hid-layout',
    name: 'Generic HID controller',
    deviceMatch: 'any HID',
    bindings: { ...DEFAULT_BINDINGS },
  }),
  createControllerProfile({
    id: 'xbox-layout',
    name: 'Xbox layout',
    deviceMatch: 'Xbox|XInput|Xbox Wireless Controller',
  }),
  createControllerProfile({
    id: 'playstation-layout',
    name: 'PlayStation layout',
    deviceMatch: 'PlayStation|Sony|Wireless Controller',
    bindings: { ...DEFAULT_BINDINGS, confirm: 'button-1', cancel: 'button-0' },
  }),
  createControllerProfile({
    id: 'nintendo-layout',
    name: 'Nintendo layout',
    deviceMatch: 'Nintendo|Pro Controller|Joy-Con',
    bindings: { ...DEFAULT_BINDINGS, confirm: 'button-1', cancel: 'button-0' },
  }),
  createControllerProfile({
    id: 'keyboard-mouse',
    name: 'Keyboard and mouse',
    bindings: { confirm: 'key-Enter', cancel: 'key-Escape', menu: 'key-Tab', pause: 'key-P' },
  }),
]);

function matchesDevice(profile, deviceName) {
  const match = String(profile.deviceMatch || '').trim();
  if (!match || ['any', 'any hid'].includes(match.toLowerCase())) return false;
  if (typeof deviceName !== 'string' || !deviceName.trim()) return false;
  try {
    return new RegExp(match, 'i').test(deviceName);
  } catch {
    return deviceName.toLowerCase().includes(match.toLowerCase());
  }
}

export function resolveControllerProfile({
  profileId = 'auto',
  deviceName = '',
  profiles = [],
  fallback = null,
} = {}) {
  const requested = String(profileId || '')
    .trim()
    .toLowerCase();
  const available = [...profiles, ...BUILTIN_CONTROLLER_PROFILES];
  if (!requested || requested === 'auto' || requested === 'auto-detect') {
    if (!String(deviceName || '').trim()) return fallback;
    return (
      available.find((profile) => matchesDevice(profile, deviceName)) ||
      available.find((profile) => profile.deviceMatch.toLowerCase() === 'any hid') ||
      available.find((profile) => profile.deviceMatch.toLowerCase() === 'any') ||
      fallback
    );
  }
  return (
    available.find(
      (profile) => profile.id === requested || profile.name.toLowerCase() === requested,
    ) || fallback
  );
}
