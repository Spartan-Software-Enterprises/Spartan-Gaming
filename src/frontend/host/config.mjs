const PLATFORMS = new Set(['win32', 'darwin', 'linux']);
const BACKENDS = new Set(['Automatic', 'Browser Gamepad', 'Linux uinput', 'Windows external driver', 'macOS external driver', 'Disabled']);
const AUDIO_BACKENDS = new Set(['Automatic', 'PipeWire', 'PulseAudio', 'WASAPI', 'CoreAudio']);

function text(value, maximum = 256) { return typeof value === 'string' && value.trim() && value.length <= maximum ? value.trim() : undefined; }
function number(value, fallback, minimum, maximum) { const result = Number(value); return Number.isInteger(result) ? Math.max(minimum, Math.min(maximum, result)) : fallback; }

/** Convert browser settings into a portable, secret-free host/agent config. */
export function createHostConfigFromSettings({platform, settings = {}, host = {}} = {}) {
  if (!PLATFORMS.has(platform)) throw new TypeError(`unsupported host configuration platform: ${platform}`);
  const config = {
    platform,
    ...(text(host.hostId, 128) ? {hostId: text(host.hostId, 128)} : {}),
    ...(text(host.name, 128) ? {hostName: text(host.name, 128)} : {}),
    port: number(settings['host.sessionPort'], 8787, 0, 65535),
    ...(text(settings['host.nativePackage'], 160) ? {nativePackage: text(settings['host.nativePackage'], 160)} : {}),
    virtualGamepadBackend: BACKENDS.has(settings['controllers.virtualGamepadBackend']) ? settings['controllers.virtualGamepadBackend'] : 'Automatic',
    ...(text(settings['controllers.virtualGamepadPackage'], 160) ? {virtualGamepadPackage: text(settings['controllers.virtualGamepadPackage'], 160)} : {}),
    ...(text(settings['controllers.virtualGamepadDevice'], 128) ? {virtualGamepadDevice: text(settings['controllers.virtualGamepadDevice'], 128)} : {}),
    enableInput: settings['host.allowInputInjection'] !== false,
    enableNativeMedia: settings['host.enableNativeMedia'] === true,
    enableNativeAudio: settings['host.enableNativeAudio'] === true,
    ...(text(settings['host.audioSource'], 256) ? {audioSource: text(settings['host.audioSource'], 256)} : {}),
    ...(AUDIO_BACKENDS.has(settings['host.audioBackend']) && settings['host.audioBackend'] !== 'Automatic' ? {audioBackend: settings['host.audioBackend']} : {}),
  };
  return Object.freeze(config);
}
