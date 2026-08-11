const PLATFORMS = new Set(['win32', 'darwin', 'linux']);
const KINDS = new Set(['capture', 'audio', 'input']);
const OPERATIONS = Object.freeze({
  capture: Object.freeze(['start', 'stop']),
  audio: Object.freeze(['start', 'stop']),
  input: Object.freeze(['execute']),
});
const PLATFORM_SPECS = Object.freeze({
  win32: Object.freeze({
    id: 'windows-native',
    technologies: Object.freeze({
      capture: 'Windows Graphics Capture / Desktop Duplication',
      audio: 'WASAPI',
      input: 'SendInput / XInput rumble',
    }),
    permission: Object.freeze({
      capture: 'screen-capture',
      audio: 'microphone-capture',
      input: 'remote-input',
    }),
  }),
  darwin: Object.freeze({
    id: 'macos-native',
    technologies: Object.freeze({
      capture: 'ScreenCaptureKit / AVFoundation',
      audio: 'CoreAudio',
      input: 'CGEvent / CoreHaptics',
    }),
    permission: Object.freeze({
      capture: 'screen-recording',
      audio: 'microphone-capture',
      input: 'remote-input',
    }),
  }),
  linux: Object.freeze({
    id: 'linux-native',
    technologies: Object.freeze({
      capture: 'PipeWire / xdg-desktop-portal',
      audio: 'PipeWire / PulseAudio',
      input: 'uinput',
    }),
    permission: Object.freeze({
      capture: 'screen-capture',
      audio: 'audio-session',
      input: 'remote-input',
    }),
  }),
});

function required(value, name) {
  if (typeof value !== 'string' || !value.trim())
    throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}

/**
 * Create one platform adapter from an injected native binding implementation.
 * The kit owns platform identity, operation shape, and permissions; the
 * package owns the actual Windows/macOS/Linux API calls.
 */
export function createPlatformNativeAdapter({ platform, kind, bindings } = {}) {
  if (!PLATFORMS.has(platform))
    throw new TypeError(`unsupported native adapter platform: ${platform}`);
  if (!KINDS.has(kind)) throw new TypeError(`unsupported native adapter kind: ${kind}`);
  if (!bindings || typeof bindings !== 'object')
    throw new TypeError('native bindings are required');
  for (const operation of OPERATIONS[kind])
    if (typeof bindings[operation] !== 'function')
      throw new TypeError(`${platform} ${kind} adapter requires bindings.${operation}()`);
  const spec = PLATFORM_SPECS[platform];
  const adapter = {
    platform,
    kind,
    id: `${spec.id}-${kind}`,
    technology: spec.technologies[kind],
    permission: spec.permission[kind],
    capabilities: Object.freeze({
      platform,
      kind,
      technology: spec.technologies[kind],
      permission: spec.permission[kind],
    }),
    close: () => bindings.close?.(),
  };
  for (const operation of OPERATIONS[kind])
    adapter[operation] = (...args) => bindings[operation](...args);
  return Object.freeze(adapter);
}

/** Return the immutable platform package metadata used by signed manifests. */
export function getPlatformNativeAdapterSpec(platform, kind) {
  if (!PLATFORMS.has(platform))
    throw new TypeError(`unsupported native adapter platform: ${platform}`);
  if (!KINDS.has(kind)) throw new TypeError(`unsupported native adapter kind: ${kind}`);
  const spec = PLATFORM_SPECS[platform];
  return Object.freeze({
    platform,
    kind,
    id: `${spec.id}-${kind}`,
    technology: spec.technologies[kind],
    permission: spec.permission[kind],
    operations: OPERATIONS[kind],
  });
}

export const PLATFORM_NATIVE_ADAPTER_SPECS = Object.freeze(
  Object.fromEntries(
    [...PLATFORMS].flatMap((platform) =>
      [...KINDS].map((kind) => [
        `${platform}-${kind}`,
        getPlatformNativeAdapterSpec(platform, kind),
      ]),
    ),
  ),
);
