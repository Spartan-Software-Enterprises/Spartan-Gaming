import { controllerPolicyFromSettings } from '../input/controller-policy.mjs';

const PLATFORMS = new Set(['win32', 'darwin', 'linux']);
const BACKENDS = new Set([
  'Automatic',
  'Browser Gamepad',
  'Linux uinput',
  'Windows external driver',
  'macOS external driver',
  'Disabled',
]);
const AUDIO_BACKENDS = new Set(['Automatic', 'PipeWire', 'PulseAudio', 'WASAPI', 'CoreAudio']);
const CAPTURE_SOURCES = new Set([
  'Automatic',
  'Primary display',
  'Selected display',
  'Selected window',
]);
const VIDEO_CODECS = new Set(['Automatic', 'H.264', 'VP9', 'AV1', 'HEVC']);
const RESOLUTIONS = new Set(['720p', '1080p', '1440p', '4K', 'Source']);
const FRAMERATES = new Set(['30 FPS', '60 FPS', '90 FPS', '120 FPS', '144 FPS']);
const AUDIO_CODECS = new Set(['Automatic', 'Opus', 'AAC']);
const LOG_LEVELS = new Set(['Errors only', 'Connection events', 'Verbose']);

/** Resolve the host OS using Electron's authoritative platform when available. */
export function detectHostPlatform({ electronPlatform, navigatorRef = globalThis.navigator } = {}) {
  if (PLATFORMS.has(electronPlatform)) return electronPlatform;
  const platform = String(navigatorRef?.userAgentData?.platform || '').toLowerCase();
  if (platform.includes('mac')) return 'darwin';
  if (platform.includes('win')) return 'win32';
  const userAgent = String(navigatorRef?.userAgent || '').toLowerCase();
  if (userAgent.includes('windows')) return 'win32';
  if (userAgent.includes('mac os') || userAgent.includes('macintosh')) return 'darwin';
  return 'linux';
}

function text(value, maximum = 256) {
  return typeof value === 'string' && value.trim() && value.length <= maximum
    ? value.trim()
    : undefined;
}
function number(value, fallback, minimum, maximum) {
  const result = Number(value);
  return Number.isInteger(result) ? Math.max(minimum, Math.min(maximum, result)) : fallback;
}
function deviceIds(value) {
  if (typeof value !== 'string') return [];
  return [
    ...new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ]
    .slice(0, 8)
    .filter((item) => item.length <= 128);
}
function option(value, allowed, fallback) {
  return allowed.has(value) ? value : fallback;
}
function jsonObject(value) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** Convert browser settings into a portable, secret-free host/agent config. */
export function createHostConfigFromSettings({ platform, settings = {}, host = {} } = {}) {
  if (!PLATFORMS.has(platform))
    throw new TypeError(`unsupported host configuration platform: ${platform}`);
  const config = {
    platform,
    ...(text(host.hostId, 128) ? { hostId: text(host.hostId, 128) } : {}),
    ...(text(host.name, 128) ? { hostName: text(host.name, 128) } : {}),
    port: number(settings['host.sessionPort'], 8787, 0, 65535),
    ...(text(settings['host.nativePackage'], 160)
      ? { nativePackage: text(settings['host.nativePackage'], 160) }
      : {}),
    protonEnabled: settings['host.protonEnabled'] === true,
    ...(text(settings['host.protonPath'], 1024)
      ? { protonPath: text(settings['host.protonPath'], 1024) }
      : {}),
    ...(text(settings['host.protonVersion'], 80)
      ? { protonVersion: text(settings['host.protonVersion'], 80) }
      : {}),
    ...(text(settings['host.protonCompatDataPath'], 1024)
      ? { protonCompatDataPath: text(settings['host.protonCompatDataPath'], 1024) }
      : {}),
    ...(text(settings['host.protonSteamClientPath'], 1024)
      ? { protonSteamClientPath: text(settings['host.protonSteamClientPath'], 1024) }
      : {}),
    ...(jsonObject(settings['host.protonEnvironment'])
      ? { protonOptions: jsonObject(settings['host.protonEnvironment']) }
      : {}),
    steamOsEnabled: settings['host.steamOsEnabled'] === true,
    steamOsMode: settings['host.steamOsMode'] === 'Desktop Mode' ? 'desktop' : 'game',
    gamescopeEnabled: settings['host.gamescopeEnabled'] === true,
    steamOsFramerate: Number.parseInt(String(settings['host.steamOsFramerate'] || '60'), 10) || 60,
    steamInputMode:
      settings['host.steamInputMode'] === 'Official action metadata'
        ? 'official-actions'
        : 'fallback',
    steamOsLaunchMode:
      {
        'Native Linux': 'native-linux',
        Proton: 'proton',
        'Steam-owned': 'steam',
        'Non-Steam': 'non-steam',
      }[settings['host.steamOsLaunchMode']] || 'native-linux',
    ...(text(settings['host.steamAppId'], 9)
      ? { steamAppId: text(settings['host.steamAppId'], 9) }
      : {}),
    captureSource: option(settings['host.captureSource'], CAPTURE_SOURCES, 'Automatic'),
    videoCodec: option(settings['host.videoCodec'], VIDEO_CODECS, 'Automatic'),
    maxResolution: option(settings['host.maxResolution'], RESOLUTIONS, '1080p'),
    maxFramerate: option(settings['host.maxFramerate'], FRAMERATES, '60 FPS'),
    captureSystemAudio: settings['host.captureSystemAudio'] !== false,
    captureMicrophone: settings['host.captureMicrophone'] === true,
    audioCodec: option(settings['host.audioCodec'], AUDIO_CODECS, 'Automatic'),
    virtualGamepadBackend: BACKENDS.has(settings['controllers.virtualGamepadBackend'])
      ? settings['controllers.virtualGamepadBackend']
      : 'Automatic',
    ...(text(settings['controllers.virtualGamepadPackage'], 160)
      ? { virtualGamepadPackage: text(settings['controllers.virtualGamepadPackage'], 160) }
      : {}),
    ...(text(settings['host.virtualGamepadInstallRoot'], 1024)
      ? { virtualGamepadInstallRoot: text(settings['host.virtualGamepadInstallRoot'], 1024) }
      : {}),
    ...(text(settings['host.virtualGamepadAdapterId'], 128)
      ? { virtualGamepadAdapterId: text(settings['host.virtualGamepadAdapterId'], 128) }
      : {}),
    ...(text(settings['controllers.virtualGamepadDevice'], 128)
      ? { virtualGamepadDevice: text(settings['controllers.virtualGamepadDevice'], 128) }
      : {}),
    ...(deviceIds(settings['controllers.virtualGamepadDevices']).length
      ? { virtualGamepadDevices: deviceIds(settings['controllers.virtualGamepadDevices']) }
      : {}),
    controllerPolicy: controllerPolicyFromSettings(settings),
    enableInput: settings['host.allowInputInjection'] !== false,
    enableNativeMedia: settings['host.enableNativeMedia'] === true,
    enableNativeAudio: settings['host.enableNativeAudio'] === true,
    ...(text(settings['host.audioSource'], 256)
      ? { audioSource: text(settings['host.audioSource'], 256) }
      : {}),
    ...(AUDIO_BACKENDS.has(settings['host.audioBackend']) &&
    settings['host.audioBackend'] !== 'Automatic'
      ? { audioBackend: settings['host.audioBackend'] }
      : {}),
    requireExplicitPairing: settings['host.requireExplicitPairing'] !== false,
    wakeOnLan: settings['host.wakeOnLan'] === true,
    logLevel: option(settings['host.logLevel'], LOG_LEVELS, 'Connection events'),
  };
  return Object.freeze(config);
}
