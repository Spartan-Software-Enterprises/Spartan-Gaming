import {controllerPolicyFromSettings} from '../input/controller-policy.mjs';

const PLATFORMS = new Set(['win32', 'darwin', 'linux']);
const BACKENDS = new Set(['Automatic', 'Browser Gamepad', 'Linux uinput', 'Windows external driver', 'macOS external driver', 'Disabled']);
const AUDIO_BACKENDS = new Set(['Automatic', 'PipeWire', 'PulseAudio', 'WASAPI', 'CoreAudio']);
const CAPTURE_SOURCES = new Set(['Automatic', 'Primary display', 'Selected display', 'Selected window']);
const VIDEO_CODECS = new Set(['Automatic', 'H.264', 'VP9', 'AV1', 'HEVC']);
const RESOLUTIONS = new Set(['720p', '1080p', '1440p', '4K', 'Source']);
const FRAMERATES = new Set(['30 FPS', '60 FPS', '90 FPS', '120 FPS', '144 FPS']);
const AUDIO_CODECS = new Set(['Automatic', 'Opus', 'AAC']);
const LOG_LEVELS = new Set(['Errors only', 'Connection events', 'Verbose']);

function text(value, maximum = 256) { return typeof value === 'string' && value.trim() && value.length <= maximum ? value.trim() : undefined; }
function number(value, fallback, minimum, maximum) { const result = Number(value); return Number.isInteger(result) ? Math.max(minimum, Math.min(maximum, result)) : fallback; }
function deviceIds(value) { if (typeof value !== 'string') return []; return [...new Set(value.split(',').map(item => item.trim()).filter(Boolean))].slice(0, 8).filter(item => item.length <= 128); }
function option(value, allowed, fallback) { return allowed.has(value) ? value : fallback; }

/** Convert browser settings into a portable, secret-free host/agent config. */
export function createHostConfigFromSettings({platform, settings = {}, host = {}} = {}) {
  if (!PLATFORMS.has(platform)) throw new TypeError(`unsupported host configuration platform: ${platform}`);
  const config = {
    platform,
    ...(text(host.hostId, 128) ? {hostId: text(host.hostId, 128)} : {}),
    ...(text(host.name, 128) ? {hostName: text(host.name, 128)} : {}),
    port: number(settings['host.sessionPort'], 8787, 0, 65535),
    ...(text(settings['host.nativePackage'], 160) ? {nativePackage: text(settings['host.nativePackage'], 160)} : {}),
    captureSource: option(settings['host.captureSource'], CAPTURE_SOURCES, 'Automatic'),
    videoCodec: option(settings['host.videoCodec'], VIDEO_CODECS, 'Automatic'),
    maxResolution: option(settings['host.maxResolution'], RESOLUTIONS, '1080p'),
    maxFramerate: option(settings['host.maxFramerate'], FRAMERATES, '60 FPS'),
    captureSystemAudio: settings['host.captureSystemAudio'] !== false,
    captureMicrophone: settings['host.captureMicrophone'] === true,
    audioCodec: option(settings['host.audioCodec'], AUDIO_CODECS, 'Automatic'),
    virtualGamepadBackend: BACKENDS.has(settings['controllers.virtualGamepadBackend']) ? settings['controllers.virtualGamepadBackend'] : 'Automatic',
    ...(text(settings['controllers.virtualGamepadPackage'], 160) ? {virtualGamepadPackage: text(settings['controllers.virtualGamepadPackage'], 160)} : {}),
    ...(text(settings['controllers.virtualGamepadDevice'], 128) ? {virtualGamepadDevice: text(settings['controllers.virtualGamepadDevice'], 128)} : {}),
    ...(deviceIds(settings['controllers.virtualGamepadDevices']).length ? {virtualGamepadDevices: deviceIds(settings['controllers.virtualGamepadDevices'])} : {}),
    controllerPolicy: controllerPolicyFromSettings(settings),
    enableInput: settings['host.allowInputInjection'] !== false,
    enableNativeMedia: settings['host.enableNativeMedia'] === true,
    enableNativeAudio: settings['host.enableNativeAudio'] === true,
    ...(text(settings['host.audioSource'], 256) ? {audioSource: text(settings['host.audioSource'], 256)} : {}),
    ...(AUDIO_BACKENDS.has(settings['host.audioBackend']) && settings['host.audioBackend'] !== 'Automatic' ? {audioBackend: settings['host.audioBackend']} : {}),
    requireExplicitPairing: settings['host.requireExplicitPairing'] !== false,
    wakeOnLan: settings['host.wakeOnLan'] === true,
    logLevel: option(settings['host.logLevel'], LOG_LEVELS, 'Connection events'),
  };
  return Object.freeze(config);
}
