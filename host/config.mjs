import {readFileSync} from 'node:fs';
import {normalizeVirtualGamepadConfig} from './virtual-gamepad-config.mjs';
import {normalizeControllerPolicy} from '../src/frontend/input/controller-policy.mjs';
import {normalizeProtonEnvironment} from './proton.mjs';

const KEYS = new Set(['platform', 'hostId', 'hostName', 'bind', 'port', 'nativePackage', 'protonEnabled', 'protonPath', 'protonVersion', 'protonCompatDataPath', 'protonSteamClientPath', 'protonOptions', 'captureSource', 'videoCodec', 'maxResolution', 'maxFramerate', 'captureSystemAudio', 'captureMicrophone', 'audioCodec', 'virtualGamepadPackage', 'virtualGamepadInstallRoot', 'virtualGamepadAdapterId', 'virtualGamepadBackend', 'virtualGamepadDevice', 'virtualGamepadDevices', 'controllerPolicy', 'enableInput', 'enableNativeMedia', 'enableNativeAudio', 'audioSource', 'audioBackend', 'requireExplicitPairing', 'wakeOnLan', 'logLevel', 'tlsKey', 'tlsCert', 'allowedOrigins', 'maxConnections', 'maxMessagesPerSecond']);
const SECRET_KEYS = new Set(['secret', 'adminSecret', 'turnSecret', 'pairingCode', 'signalTicket']);
const NATIVE_PLATFORMS = new Set(['win32', 'darwin', 'linux']);
const CAPTURE_SOURCES = new Set(['Automatic', 'Primary display', 'Selected display', 'Selected window']);
const VIDEO_CODECS = new Set(['Automatic', 'H.264', 'VP9', 'AV1', 'HEVC']);
const RESOLUTIONS = new Set(['720p', '1080p', '1440p', '4K', 'Source']);
const FRAMERATES = new Set(['30 FPS', '60 FPS', '90 FPS', '120 FPS', '144 FPS']);
const AUDIO_CODECS = new Set(['Automatic', 'Opus', 'AAC']);
const LOG_LEVELS = new Set(['Errors only', 'Connection events', 'Verbose']);
const RESOLUTION_DIMENSIONS = Object.freeze({ '720p': Object.freeze([1280, 720]), '1080p': Object.freeze([1920, 1080]), '1440p': Object.freeze([2560, 1440]), '4K': Object.freeze([3840, 2160]) });
const FRAMERATE_VALUES = Object.freeze({'30 FPS': 30, '60 FPS': 60, '90 FPS': 90, '120 FPS': 120, '144 FPS': 144});
const VIDEO_CODEC_VALUES = Object.freeze({'H.264': 'h264', VP9: 'vp9', AV1: 'av1', HEVC: 'h264'});
const AUDIO_CODEC_VALUES = Object.freeze({Opus: 'opus', AAC: 'aac'});

function text(value, name, maximum = 256) { if (value === undefined || value === null || value === '') return undefined; if (typeof value !== 'string' || !value.trim() || value.length > maximum || /[\u0000\r\n]/.test(value)) throw new TypeError(`${name} must be a bounded single-line string`); return value.trim(); }
function integer(value, name, fallback, minimum, maximum) { if (value === undefined) return fallback; const result = Number(value); if (!Number.isInteger(result) || result < minimum || result > maximum) throw new RangeError(`${name} must be between ${minimum} and ${maximum}`); return result; }
function flag(value, name, fallback = false) { if (value === undefined) return fallback; if (typeof value !== 'boolean') throw new TypeError(`${name} must be boolean`); return value; }
function option(value, allowed, name, fallback) { if (value === undefined) return fallback; if (!allowed.has(value)) throw new TypeError(`${name} is not supported`); return value; }

export function normalizeHostConfig(input = {}, {platform = process.platform} = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('host configuration must be an object');
  for (const key of Object.keys(input)) { if (SECRET_KEYS.has(key)) throw new Error(`${key} cannot be stored in host configuration`); if (!KEYS.has(key)) throw new Error(`unknown host configuration key: ${key}`); }
  const selectedPlatform = text(input.platform, 'platform', 16) || platform;
  if (selectedPlatform !== platform) throw new Error(`host configuration platform ${selectedPlatform} does not match runtime platform ${platform}`);
  const allowedOrigins = input.allowedOrigins === undefined ? [] : (Array.isArray(input.allowedOrigins) ? input.allowedOrigins.map((origin, index) => text(origin, `allowedOrigins[${index}]`, 512)) : (() => { throw new TypeError('allowedOrigins must be an array'); })());
  if (allowedOrigins.some(origin => !/^https:\/\//i.test(origin))) throw new TypeError('allowedOrigins must contain HTTPS origins');
  const virtualGamepad = NATIVE_PLATFORMS.has(selectedPlatform) ? normalizeVirtualGamepadConfig({platform: selectedPlatform, backend: input.virtualGamepadBackend, packageName: input.virtualGamepadPackage, deviceId: input.virtualGamepadDevice, deviceIds: input.virtualGamepadDevices}) : Object.freeze({version: 1, platform: selectedPlatform, backend: 'Disabled', packageName: null, deviceId: null, deviceIds: Object.freeze([]), compatible: true, requires: Object.freeze([])});
  const protonOptions = input.protonOptions === undefined ? Object.freeze({}) : normalizeProtonEnvironment({options: input.protonOptions});
  return Object.freeze({platform: selectedPlatform, hostId: text(input.hostId, 'hostId', 128), hostName: text(input.hostName, 'hostName', 128), bind: text(input.bind, 'bind', 128), port: integer(input.port, 'port', 8787, 0, 65535), nativePackage: text(input.nativePackage, 'nativePackage', 160), protonEnabled: flag(input.protonEnabled, 'protonEnabled'), protonPath: text(input.protonPath, 'protonPath', 1024), protonVersion: text(input.protonVersion, 'protonVersion', 80), protonCompatDataPath: text(input.protonCompatDataPath, 'protonCompatDataPath', 1024), protonSteamClientPath: text(input.protonSteamClientPath, 'protonSteamClientPath', 1024), protonOptions, captureSource: option(input.captureSource, CAPTURE_SOURCES, 'captureSource', 'Automatic'), videoCodec: option(input.videoCodec, VIDEO_CODECS, 'videoCodec', 'Automatic'), maxResolution: option(input.maxResolution, RESOLUTIONS, 'maxResolution', '1080p'), maxFramerate: option(input.maxFramerate, FRAMERATES, 'maxFramerate', '60 FPS'), captureSystemAudio: flag(input.captureSystemAudio, 'captureSystemAudio', true), captureMicrophone: flag(input.captureMicrophone, 'captureMicrophone'), audioCodec: option(input.audioCodec, AUDIO_CODECS, 'audioCodec', 'Automatic'), virtualGamepadPackage: virtualGamepad.packageName, virtualGamepadInstallRoot: text(input.virtualGamepadInstallRoot, 'virtualGamepadInstallRoot', 1024), virtualGamepadAdapterId: text(input.virtualGamepadAdapterId, 'virtualGamepadAdapterId', 128), virtualGamepadBackend: virtualGamepad.backend, virtualGamepadDevice: virtualGamepad.deviceId, virtualGamepadDevices: virtualGamepad.deviceIds, controllerPolicy: normalizeControllerPolicy(input.controllerPolicy), enableInput: flag(input.enableInput, 'enableInput'), enableNativeMedia: flag(input.enableNativeMedia, 'enableNativeMedia'), enableNativeAudio: flag(input.enableNativeAudio, 'enableNativeAudio'), audioSource: text(input.audioSource, 'audioSource', 256), audioBackend: text(input.audioBackend, 'audioBackend', 64), requireExplicitPairing: flag(input.requireExplicitPairing, 'requireExplicitPairing', true), wakeOnLan: flag(input.wakeOnLan, 'wakeOnLan'), logLevel: option(input.logLevel, LOG_LEVELS, 'logLevel', 'Connection events'), tlsKey: text(input.tlsKey, 'tlsKey', 512), tlsCert: text(input.tlsCert, 'tlsCert', 512), allowedOrigins: Object.freeze([...new Set(allowedOrigins)]), maxConnections: integer(input.maxConnections, 'maxConnections', 8, 1, 256), maxMessagesPerSecond: integer(input.maxMessagesPerSecond, 'maxMessagesPerSecond', 120, 1, 10000), virtualGamepad});
}

export function readHostConfig(path, {platform = process.platform, readFile = readFileSync} = {}) {
  const location = text(path, 'config path', 1024); if (!location) return normalizeHostConfig({}, {platform});
  let parsed; try { parsed = JSON.parse(readFile(location, 'utf8')); } catch { throw new Error('host configuration file is not valid JSON'); }
  return normalizeHostConfig(parsed, {platform});
}

/** Project non-secret host settings into the health/preflight diagnostic. */
export function createHostRuntimePolicy(config = {}) {
  if (!config || typeof config !== 'object') throw new TypeError('normalized host configuration is required');
  return Object.freeze({captureSource: config.captureSource || 'Automatic', videoCodec: config.videoCodec || 'Automatic', maxResolution: config.maxResolution || '1080p', maxFramerate: config.maxFramerate || '60 FPS', captureSystemAudio: config.captureSystemAudio !== false, captureMicrophone: config.captureMicrophone === true, audioCodec: config.audioCodec || 'Automatic', enableNativeMedia: config.enableNativeMedia === true, enableNativeAudio: config.enableNativeAudio === true, enableInput: config.enableInput !== false, requireExplicitPairing: config.requireExplicitPairing !== false, wakeOnLan: config.wakeOnLan === true, logLevel: config.logLevel || 'Connection events'});
}

/** Resolve portable labels into bounded native media parameters. */
export function createHostMediaPolicy(config = {}) {
  const runtime = createHostRuntimePolicy(config);
  const dimensions = RESOLUTION_DIMENSIONS[runtime.maxResolution] || RESOLUTION_DIMENSIONS['1080p'];
  return Object.freeze({...runtime, width: dimensions[0], height: dimensions[1], framerate: FRAMERATE_VALUES[runtime.maxFramerate] || 60, videoCodec: VIDEO_CODEC_VALUES[runtime.videoCodec] || 'h264', audioCodec: AUDIO_CODEC_VALUES[runtime.audioCodec] || 'opus'});
}
