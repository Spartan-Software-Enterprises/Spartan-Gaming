const PROFILES = new Set(['Auto-detect', 'Xbox layout', 'Xbox Elite / Elite 2', 'PlayStation layout', 'DualSense / DualShock', 'DualSense Edge', 'Nintendo layout', 'Joy-Con pair', 'Switch Pro Controller', 'Steam Deck', 'Steam Controller', 'Stadia controller', '8BitDo / XInput', 'Arcade stick', 'Racing wheel and pedals', 'Flight stick and throttle', 'Generic HID controller', 'Keyboard and mouse']);
const INPUT_MODES = new Set(['Auto-detect', 'XInput', 'DirectInput', 'Standard Gamepad', 'HID passthrough']);
const HAPTICS = new Set(['Automatic', 'Browser vibration', 'Native rumble', 'Disabled']);
const TRIGGERS = new Set(['Analog and digital', 'Analog only', 'Digital only']);
const LATENCY = new Set(['Automatic', 'Standard', 'High frequency']);
function choice(value, allowed, fallback) { return allowed.has(value) ? value : fallback; }
function flag(value, fallback) { return typeof value === 'boolean' ? value : fallback; }
function integer(value, fallback, minimum, maximum) { const number = Number(value); return Number.isInteger(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback; }

export function normalizeControllerPolicy(input = {}) {
  return Object.freeze({version: 1, defaultProfile: choice(input.defaultProfile, PROFILES, 'Auto-detect'), inputMode: choice(input.inputMode, INPUT_MODES, 'Auto-detect'), hapticsBackend: choice(input.hapticsBackend, HAPTICS, 'Automatic'), multipleControllers: flag(input.multipleControllers, true), playerSlots: integer(input.playerSlots, 4, 1, 8), allowGamepad: flag(input.allowGamepad, true), allowHid: flag(input.allowHid, false), rumble: flag(input.rumble, true), adaptiveTriggers: flag(input.adaptiveTriggers, false), gyro: flag(input.gyro, false), touchpad: flag(input.touchpad, false), backButtons: flag(input.backButtons, false), triggerMode: choice(input.triggerMode, TRIGGERS, 'Analog and digital'), steeringRange: integer(input.steeringRange, 900, 90, 1080), splitInput: flag(input.splitInput, false), deadzone: integer(input.deadzone, 8, 0, 30), inputLatency: choice(input.inputLatency, LATENCY, 'Automatic')});
}

export function controllerPolicyFromSettings(settings = {}) {
  return normalizeControllerPolicy({defaultProfile: settings['controllers.defaultProfile'], inputMode: settings['controllers.inputMode'], hapticsBackend: settings['controllers.hapticsBackend'], multipleControllers: settings['controllers.multipleControllers'], playerSlots: settings['controllers.playerSlots'], allowGamepad: settings['controllers.allowGamepad'], allowHid: settings['controllers.allowHid'], rumble: settings['controllers.rumble'], adaptiveTriggers: settings['controllers.adaptiveTriggers'], gyro: settings['controllers.gyro'], touchpad: settings['controllers.touchpad'], backButtons: settings['controllers.backButtons'], triggerMode: settings['controllers.triggerMode'], steeringRange: settings['controllers.steeringRange'], splitInput: settings['controllers.splitInput'], deadzone: settings['controllers.deadzone'], inputLatency: settings['controllers.inputLatency']});
}

export function controllerPolicyAllowsEvent(event, policy = normalizeControllerPolicy()) {
  const normalized = normalizeControllerPolicy(policy); const kind = event?.kind || (event?.source === 'gamepad' ? 'button' : event?.source);
  if (kind === 'rumble') return normalized.rumble && normalized.hapticsBackend !== 'Disabled';
  if (event?.source === 'hid') return normalized.allowHid;
  if (event?.source === 'gamepad' || ['button', 'axis'].includes(kind)) { const index = Number.isInteger(event?.gamepadIndex) ? event.gamepadIndex : 0; return normalized.allowGamepad && (normalized.multipleControllers || index === 0) && index < normalized.playerSlots; }
  return true;
}
