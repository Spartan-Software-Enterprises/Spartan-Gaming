import {createAudioCapturePlan, createAudioPublisherPlan} from './audio.mjs';
import {createCapturePlan, createEncoderPlan} from './media.mjs';
import {createNativeHostSession} from './native-session.mjs';

const PLATFORMS = new Set(['win32', 'darwin', 'linux']);
function required(value, name) { if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`); return value.trim(); }
function captureDefaults(platform, environment, source) { if (source) return source; if (platform === 'win32') return {sourceType: 'desktop', source: 'desktop'}; if (platform === 'darwin') return {sourceType: 'avfoundation', source: '1'}; if (environment.WAYLAND_DISPLAY || environment.XDG_RUNTIME_DIR) return {sourceType: 'pipewire', source: 'default'}; return {sourceType: 'x11', source: required(environment.DISPLAY, 'environment.DISPLAY')}; }
function audioDefaults(platform, environment, source) { if (source) return source; if (platform === 'win32') return {backend: 'wasapi', source: 'default'}; if (platform === 'darwin') return {backend: 'coreaudio', source: 'default'}; return environment.WAYLAND_DISPLAY || environment.XDG_RUNTIME_DIR ? {backend: 'pipewire', source: 'default'} : {backend: 'pulse', source: 'default'}; }

/** Select platform-native capture/audio plans without executing them. */
export function createPlatformRuntimePlans({platform, environment = {}, source, audioSource, width = 1920, height = 1080, framerate = 60, codec = 'h264', bitrateKbps = 10_000, includeAudio = true} = {}) {
  if (!PLATFORMS.has(platform)) throw new TypeError(`unsupported platform: ${platform}`);
  const selectedCapture = captureDefaults(platform, environment, source); const capturePlan = createCapturePlan({platform, ...selectedCapture, width, height, framerate, audio: includeAudio, environment}); const encoderPlan = createEncoderPlan({codec, width, height, framerate, bitrateKbps});
  const audioPlan = includeAudio ? createAudioCapturePlan({platform, ...audioDefaults(platform, environment, audioSource), environment}) : null;
  const audioPublisherPlan = audioPlan ? createAudioPublisherPlan({capturePlan: audioPlan}) : null;
  return Object.freeze({platform, capture: capturePlan, encoder: encoderPlan, audio: audioPlan, audioPublisher: audioPublisherPlan});
}

/** Bind selected plans to injected publishers/input and the native lifecycle. */
export function createPlatformHostRuntime({platform, plans, mediaPublisher, audioPublisher = null, inputExecutor = null, requireAudio = false} = {}) {
  if (!PLATFORMS.has(platform)) throw new TypeError(`unsupported platform: ${platform}`);
  if (!plans || plans.platform !== platform || plans.capture?.platform !== platform || (plans.audio && plans.audio.platform !== platform)) throw new TypeError('platform runtime plans must match the host platform');
  const session = createNativeHostSession({platform, mediaPublisher, audioPublisher, inputExecutor, requireAudio});
  return Object.freeze({platform, plans, session});
}
