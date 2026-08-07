import {normalizeRemoteInputEvent} from '../src/frontend/input/input.mjs';

const PLATFORMS = new Set(['win32', 'darwin', 'linux']);
const STATES = new Set(['unconfigured', 'plan-only', 'ready', 'active', 'failed']);
const KINDS = new Set(['button', 'axis', 'key', 'pointer', 'touch', 'rumble']);

const ADAPTERS = Object.freeze({
  win32: Object.freeze({id: 'windows-send-input', technologies: Object.freeze(['SendInput', 'XInput/virtual-HID-adapter'])}),
  darwin: Object.freeze({id: 'macos-cgevent-hid', technologies: Object.freeze(['CGEventPost', 'IOHIDUserDevice'])}),
  linux: Object.freeze({id: 'linux-uinput', technologies: Object.freeze(['uinput', 'libinput-compatible device adapter'])}),
});

function bounded(value, fallback, minimum, maximum) { const number = Number(value); return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback; }

export function normalizeInputAdapterCapabilities(capabilities = {}) {
  const platform = PLATFORMS.has(capabilities.platform) ? capabilities.platform : 'unknown';
  const state = STATES.has(capabilities.state) ? capabilities.state : 'unconfigured';
  return Object.freeze({
    version: 1,
    platform,
    state,
    adapter: ADAPTERS[platform]?.id || null,
    keyboard: Boolean(capabilities.keyboard),
    pointer: Boolean(capabilities.pointer),
    gamepad: Boolean(capabilities.gamepad),
    rumble: Boolean(capabilities.rumble),
    requires: Object.freeze(Array.isArray(capabilities.requires) && capabilities.requires.length ? [...new Set(capabilities.requires.map(String))] : ['native-input-adapter', 'permission-grant']),
  });
}

export function createInputInjectionPlan({platform, event, permissions = {}} = {}) {
  if (!PLATFORMS.has(platform)) throw new TypeError(`unsupported input platform: ${platform}`);
  const normalized = normalizeRemoteInputEvent(event);
  const kind = normalized.kind || (normalized.source === 'keyboard' ? 'key' : normalized.source === 'pointer' ? 'pointer' : 'button');
  if (!KINDS.has(kind)) throw new TypeError(`unsupported input kind: ${kind}`);
  const adapter = ADAPTERS[platform];
  const requiredPermission = kind === 'key' || kind === 'pointer' || kind === 'touch' ? 'remote-input' : kind === 'rumble' ? 'haptic-output' : 'virtual-gamepad';
  const allowed = permissions[requiredPermission] === true;
  return Object.freeze({
    kind: 'input-injection',
    state: 'plan-only',
    ready: false,
    platform,
    adapter: adapter.id,
    technologies: adapter.technologies,
    operation: Object.freeze({kind, action: normalized.action, pressed: normalized.pressed, value: normalized.value, control: normalized.control, x: bounded(normalized.x, 0, 0, 1), y: bounded(normalized.y, 0, 0, 1), deltaX: bounded(normalized.deltaX, 0, -4096, 4096), deltaY: bounded(normalized.deltaY, 0, -4096, 4096), durationMs: bounded(normalized.durationMs, 0, 0, 5000)}),
    permission: Object.freeze({name: requiredPermission, granted: allowed}),
    requires: Object.freeze(['native-input-adapter', requiredPermission]),
  });
}

export function inputAdapterIsReady(capabilities) { return ['ready', 'active'].includes(normalizeInputAdapterCapabilities(capabilities).state); }

/**
 * Execute only normalized input operations through an explicitly supplied OS
 * adapter. The adapter owns platform APIs; this boundary owns permissions,
 * rate limiting, lifecycle, and the prohibition on shell-based dispatch.
 */
export function createNativeInputExecutor({platform, adapter, permissions = {}, maxEventsPerSecond = 240, clock = () => Date.now()} = {}) {
  if (!PLATFORMS.has(platform)) throw new TypeError(`unsupported input platform: ${platform}`);
  if (!adapter || adapter.platform !== platform || typeof adapter.execute !== 'function') throw new TypeError('native input adapter must match the platform and implement execute(operation)');
  const limit = Number(maxEventsPerSecond);
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new RangeError('maxEventsPerSecond must be an integer between 1 and 1000');
  let state = 'ready'; let windowStart = Number(clock()); let eventCount = 0;
  const checkRate = () => { const now = Number(clock()); if (!Number.isFinite(now)) throw new TypeError('clock must return a finite number'); if (now - windowStart >= 1000) { windowStart = now; eventCount = 0; } if (eventCount >= limit) throw new Error('native input rate limit exceeded'); eventCount += 1; };
  const executor = {
    get state() { return state; },
    get adapter() { return adapter; },
    async dispatch(event) {
      if (state !== 'ready' && state !== 'active') throw new Error(`native input executor is ${state}`);
      const plan = createInputInjectionPlan({platform, event, permissions});
      if (!plan.permission.granted) throw new Error(`native input permission not granted: ${plan.permission.name}`);
      checkRate();
      state = 'active';
      try { await adapter.execute(plan.operation); return plan; }
      catch (error) { state = 'failed'; throw error; }
    },
    close() { if (state === 'closed') return; state = 'closed'; adapter.close?.(); },
  };
  return Object.freeze(executor);
}
