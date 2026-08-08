const PLATFORMS = new Set(['win32', 'darwin', 'linux']);
const KINDS = new Set(['capture', 'audio', 'input', 'windowing', 'packaging']);
const STATES = new Set(['planned', 'available', 'ready', 'unavailable']);

const DEFAULT_ADAPTERS = Object.freeze([
  {id: 'windows-native', platform: 'win32', adapters: {capture: {technology: 'Desktop Duplication / Windows Graphics Capture', state: 'planned'}, audio: {technology: 'WASAPI', state: 'planned'}, input: {technology: 'SendInput / XInput', state: 'planned'}, windowing: {technology: 'Win32 / App SDK', state: 'planned'}, packaging: {technology: 'MSIX / signed installer', state: 'planned'}}},
  {id: 'macos-native', platform: 'darwin', adapters: {capture: {technology: 'ScreenCaptureKit', state: 'planned'}, audio: {technology: 'CoreAudio', state: 'planned'}, input: {technology: 'Core Graphics / HID', state: 'planned'}, windowing: {technology: 'AppKit', state: 'planned'}, packaging: {technology: 'notarized app bundle', state: 'planned'}}},
  {id: 'linux-native', platform: 'linux', adapters: {capture: {technology: 'PipeWire / xdg-desktop-portal', state: 'planned'}, audio: {technology: 'PipeWire / ALSA', state: 'planned'}, input: {technology: 'uinput', state: 'planned'}, windowing: {technology: 'Ozone / Wayland / X11', state: 'planned'}, packaging: {technology: 'distribution package / signed bundle', state: 'planned'}}},
]);

function required(value, name) { if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`); return value.trim(); }
function normalize(record) {
  const id = required(record?.id, 'platform adapter.id'); const platform = required(record?.platform, 'platform adapter.platform');
  if (!PLATFORMS.has(platform)) throw new TypeError(`unsupported platform adapter platform: ${platform}`);
  const adapters = Object.fromEntries([...KINDS].map(kind => { const value = record.adapters?.[kind] || {}; const state = STATES.has(value.state) ? value.state : 'unavailable'; return [kind, Object.freeze({technology: required(value.technology || 'platform API', `platform adapter.${kind}.technology`), state})]; }));
  return Object.freeze({id, platform, adapters: Object.freeze(adapters)});
}

/** Describe platform capabilities and expose only matching native boundaries. */
export function createPlatformAdapterRegistry({platform, adapters = DEFAULT_ADAPTERS} = {}) {
  const normalized = adapters.map(normalize).filter(adapter => !platform || adapter.platform === platform);
  const byKind = kind => { if (!KINDS.has(kind)) throw new TypeError(`unsupported platform adapter kind: ${kind}`); return normalized.map(adapter => Object.freeze({id: adapter.id, platform: adapter.platform, kind, ...adapter.adapters[kind]})); };
  return Object.freeze({platform: platform || null, list: () => Object.freeze([...normalized]), forKind: byKind, get(kind) { return byKind(kind)[0]; }, describe() { return Object.freeze({platform: platform || null, adapters: Object.freeze(Object.fromEntries([...KINDS].map(kind => [kind, byKind(kind)[0] || null])))}); }});
}

/** Invoke a concrete implementation only when it matches the advertised platform and kind. */
export function createPlatformAdapterBoundary({platform, registry = createPlatformAdapterRegistry({platform}), implementations = {}} = {}) {
  if (!PLATFORMS.has(platform)) throw new TypeError(`unsupported platform: ${platform}`);
  return Object.freeze({
    capabilities: registry.describe(),
    async invoke(kind, operation, ...args) {
      if (!KINDS.has(kind)) throw new TypeError(`unsupported platform adapter kind: ${kind}`);
      const descriptor = registry.get(kind); const implementation = implementations[kind];
      if (!descriptor || !implementation || descriptor.state !== 'ready' || typeof implementation[operation] !== 'function') throw new Error(`platform adapter is not ready for ${kind}.${operation}`);
      return implementation[operation](...args);
    },
  });
}

export const PLATFORM_ADAPTERS = DEFAULT_ADAPTERS.map(normalize);
