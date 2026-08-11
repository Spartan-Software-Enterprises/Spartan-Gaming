const SUPPORTED_PLATFORMS = new Set(['win32', 'darwin', 'linux']);

export const HOST_ADAPTERS = Object.freeze([
  Object.freeze({
    id: 'windows-media-foundation',
    platform: 'win32',
    kind: 'capture-encode',
    status: 'planned',
    technologies: ['Media Foundation', 'Desktop Duplication', 'WASAPI'],
  }),
  Object.freeze({
    id: 'macos-avfoundation',
    platform: 'darwin',
    kind: 'capture-encode',
    status: 'planned',
    technologies: ['AVFoundation', 'ScreenCaptureKit', 'CoreAudio'],
  }),
  Object.freeze({
    id: 'linux-pipewire',
    platform: 'linux',
    kind: 'capture-encode',
    status: 'planned',
    technologies: ['PipeWire', 'xdg-desktop-portal', 'VA-API', 'ALSA/PulseAudio'],
  }),
]);

export function createHostAdapterRegistry({
  platform = process.platform,
  adapters = HOST_ADAPTERS,
} = {}) {
  if (!SUPPORTED_PLATFORMS.has(platform))
    return Object.freeze({ platform, list: () => Object.freeze([]), primary: () => undefined });
  const available = adapters.filter((adapter) => adapter.platform === platform);
  return Object.freeze({
    platform,
    list: () => Object.freeze([...available]),
    primary: () => available[0],
  });
}

export function createProcessLaunchPlan({ executable, args = [], cwd, env = {} } = {}) {
  if (typeof executable !== 'string' || !executable.trim())
    throw new TypeError('executable must be a non-empty path');
  if (!Array.isArray(args) || args.some((argument) => typeof argument !== 'string'))
    throw new TypeError('args must be an array of strings');
  if (args.length > 128) throw new RangeError('args cannot contain more than 128 values');
  if (cwd !== undefined && (typeof cwd !== 'string' || !cwd.trim()))
    throw new TypeError('cwd must be a non-empty path when provided');
  if (!env || typeof env !== 'object' || Array.isArray(env))
    throw new TypeError('env must be an object');
  return Object.freeze({
    executable: executable.trim(),
    args: Object.freeze([...args]),
    cwd: cwd?.trim(),
    env: Object.freeze(
      Object.fromEntries(Object.entries(env).map(([key, value]) => [String(key), String(value)])),
    ),
    shell: false,
    detached: false,
  });
}
