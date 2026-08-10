import {BUILTIN_CONTROLLER_PROFILES} from './profiles.mjs';

export const CONTROLLER_PROFILE_OPTIONS = Object.freeze(['Auto-detect', ...BUILTIN_CONTROLLER_PROFILES.map(profile => profile.name)]);
const PROFILES = new Set(CONTROLLER_PROFILE_OPTIONS);
const INPUT_MODES = new Set(['Auto-detect', 'XInput', 'DirectInput', 'Standard Gamepad', 'HID passthrough']);
const VIRTUAL_GAMEPAD_BACKENDS = new Set(['Automatic', 'Browser Gamepad', 'Linux uinput', 'Windows external driver', 'macOS external driver', 'Disabled']);
const HAPTICS = new Set(['Automatic', 'Browser vibration', 'Native rumble', 'Disabled']);
const TRIGGERS = new Set(['Analog and digital', 'Analog only', 'Digital only']);
const LATENCY = new Set(['Automatic', 'Standard', 'High frequency']);
const GLYPH_STYLES = new Set(['Automatic', 'Xbox', 'PlayStation', 'Nintendo', 'Steam']);
const INPUT_POLL_INTERVALS = Object.freeze({Automatic: 100, Standard: 50, 'High frequency': 16});
function choice(value, allowed, fallback) { return allowed.has(value) ? value : fallback; }
function flag(value, fallback) { return typeof value === 'boolean' ? value : fallback; }
function integer(value, fallback, minimum, maximum) { const number = Number(value); return Number.isInteger(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback; }

export function normalizeControllerPolicy(input = {}) {
  return Object.freeze({version: 1, defaultProfile: choice(input.defaultProfile, PROFILES, 'Auto-detect'), inputMode: choice(input.inputMode, INPUT_MODES, 'Auto-detect'), glyphStyle: choice(input.glyphStyle, GLYPH_STYLES, 'Automatic'), virtualGamepadBackend: choice(input.virtualGamepadBackend, VIRTUAL_GAMEPAD_BACKENDS, 'Automatic'), hapticsBackend: choice(input.hapticsBackend, HAPTICS, 'Automatic'), multipleControllers: flag(input.multipleControllers, true), playerSlots: integer(input.playerSlots, 4, 1, 8), allowGamepad: flag(input.allowGamepad, true), allowHid: flag(input.allowHid, false), rumble: flag(input.rumble, true), adaptiveTriggers: flag(input.adaptiveTriggers, false), gyro: flag(input.gyro, false), touchpad: flag(input.touchpad, false), backButtons: flag(input.backButtons, false), triggerMode: choice(input.triggerMode, TRIGGERS, 'Analog and digital'), steeringRange: integer(input.steeringRange, 900, 90, 1080), splitInput: flag(input.splitInput, false), deadzone: integer(input.deadzone, 8, 0, 30), inputLatency: choice(input.inputLatency, LATENCY, 'Automatic')});
}

export function controllerPolicyFromSettings(settings = {}) {
  return normalizeControllerPolicy({defaultProfile: settings['controllers.defaultProfile'], inputMode: settings['controllers.inputMode'], glyphStyle: settings['controllers.glyphStyle'], virtualGamepadBackend: settings['controllers.virtualGamepadBackend'], hapticsBackend: settings['controllers.hapticsBackend'], multipleControllers: settings['controllers.multipleControllers'], playerSlots: settings['controllers.playerSlots'], allowGamepad: settings['controllers.allowGamepad'], allowHid: settings['controllers.allowHid'], rumble: settings['controllers.rumble'], adaptiveTriggers: settings['controllers.adaptiveTriggers'], gyro: settings['controllers.gyro'], touchpad: settings['controllers.touchpad'], backButtons: settings['controllers.backButtons'], triggerMode: settings['controllers.triggerMode'], steeringRange: settings['controllers.steeringRange'], splitInput: settings['controllers.splitInput'], deadzone: settings['controllers.deadzone'], inputLatency: settings['controllers.inputLatency']});
}

export function controllerPollingIntervalMs(inputLatency = 'Automatic') { return INPUT_POLL_INTERVALS[inputLatency] || INPUT_POLL_INTERVALS.Automatic; }

export function controllerPolicyAllowsEvent(event, policy = normalizeControllerPolicy()) {
  const normalized = normalizeControllerPolicy(policy); const kind = event?.kind || (event?.source === 'gamepad' ? 'button' : event?.source);
  if (kind === 'rumble') { const index = Number.isInteger(event?.gamepadIndex) ? event.gamepadIndex : 0; return normalized.allowGamepad && normalized.rumble && normalized.hapticsBackend !== 'Disabled' && (normalized.multipleControllers || index === 0) && index < normalized.playerSlots; }
  if (event?.source === 'hid') return normalized.allowHid;
  if (event?.source === 'gamepad' || ['button', 'axis'].includes(kind)) { const index = Number.isInteger(event?.gamepadIndex) ? event.gamepadIndex : 0; return normalized.allowGamepad && (normalized.multipleControllers || index === 0) && index < normalized.playerSlots; }
  return true;
}
