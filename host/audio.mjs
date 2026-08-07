import {createProcessLaunchPlan} from './adapters.mjs';

const PLATFORMS = new Set(['win32', 'darwin', 'linux']);
const BACKENDS = new Set(['wasapi', 'coreaudio', 'pipewire', 'pulse']);
const CODECS = new Set(['opus', 'aac']);

function bounded(value, fallback, minimum, maximum) { const number = Number.isFinite(Number(value)) ? Number(value) : fallback; return Math.max(minimum, Math.min(maximum, number)); }
function required(value, name) { if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`); return value.trim(); }

export function listAudioBackends(platform, tool = 'ffmpeg') {
  if (!PLATFORMS.has(platform) || tool !== 'ffmpeg') return Object.freeze([]);
  const backends = platform === 'win32' ? ['wasapi'] : platform === 'darwin' ? ['coreaudio'] : ['pipewire', 'pulse'];
  return Object.freeze(backends.map(backend => Object.freeze({platform, tool, backend, status: 'plan-only', requires: backend === 'pipewire' ? ['pipewire', 'portal-permission'] : backend === 'coreaudio' ? ['microphone-permission'] : backend === 'wasapi' ? ['microphone-permission'] : ['audio-session']})));
}

export function validateAudioPermission({platform, backend, environment = {}} = {}) {
  if (!PLATFORMS.has(platform) || !BACKENDS.has(backend)) return Object.freeze({allowed: false, reason: 'Unsupported audio platform or backend'});
  if (['win32', 'darwin'].includes(platform) && environment.microphoneGranted !== true) return Object.freeze({allowed: false, reason: 'Microphone/audio capture permission is not granted'});
  if (platform === 'linux' && backend === 'pipewire' && !environment.WAYLAND_DISPLAY && !environment.XDG_RUNTIME_DIR) return Object.freeze({allowed: false, reason: 'PipeWire session environment is not available'});
  return Object.freeze({allowed: true, reason: 'Environment permits an audio capture attempt'});
}

export function createAudioCapturePlan({platform, backend, source, channels = 2, sampleRate = 48000, environment = {}} = {}) {
  required(source, 'source');
  if (!PLATFORMS.has(platform) || !BACKENDS.has(backend)) throw new TypeError('unsupported audio platform or backend');
  const permission = validateAudioPermission({platform, backend, environment});
  if (!permission.allowed) throw new Error(permission.reason);
  const boundedChannels = bounded(channels, 2, 1, 8); const boundedRate = bounded(sampleRate, 48000, 8000, 192000); const args = ['-hide_banner', '-loglevel', 'warning', '-ar', String(boundedRate), '-ac', String(boundedChannels)];
  if (backend === 'wasapi') args.unshift('-f', 'wasapi');
  else if (backend === 'coreaudio') args.unshift('-f', 'avfoundation');
  else if (backend === 'pipewire') args.unshift('-f', 'pipewire');
  else args.unshift('-f', 'pulse');
  args.push('-i', source, '-f', 'f32le', 'pipe:1');
  return Object.freeze({kind: 'audio-capture', platform, backend, source, channels: boundedChannels, sampleRate: boundedRate, permission, process: createProcessLaunchPlan({executable: 'ffmpeg', args}), output: Object.freeze({format: 'f32le', target: 'stdout', requiresPublisher: true})});
}

export function createAudioPublisherPlan({capturePlan, codec = 'opus', bitrateKbps = 128} = {}) {
  if (!capturePlan?.process?.args || capturePlan.output?.requiresPublisher !== true) throw new TypeError('capturePlan must require an audio publisher');
  if (!CODECS.has(codec)) throw new TypeError(`unsupported audio codec: ${codec}`);
  return Object.freeze({kind: 'audio-publisher', state: 'plan-only', ready: false, codec, bitrateKbps: bounded(bitrateKbps, 128, 16, 512), capture: Object.freeze({platform: capturePlan.platform, backend: capturePlan.backend, channels: capturePlan.channels, sampleRate: capturePlan.sampleRate, process: capturePlan.process}), requires: Object.freeze(['native-audio-capture', 'webrtc-audio-publisher'])});
}

export function normalizeAudioCapabilities(audio = {}) {
  return Object.freeze({version: 1, state: ['unconfigured', 'plan-only', 'ready', 'active', 'failed'].includes(audio.state) ? audio.state : 'unconfigured', codecs: Object.freeze(Array.isArray(audio.codecs) && audio.codecs.length ? [...new Set(audio.codecs.filter(codec => CODECS.has(codec)))] : ['opus']), channels: bounded(audio.channels, 2, 1, 8), sampleRate: bounded(audio.sampleRate, 48000, 8000, 192000), requires: Object.freeze(Array.isArray(audio.requires) && audio.requires.length ? [...new Set(audio.requires.map(String))] : ['native-audio-capture', 'webrtc-audio-publisher'])});
}
