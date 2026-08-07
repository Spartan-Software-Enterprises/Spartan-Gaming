import {createProcessLaunchPlan} from './adapters.mjs';

const PLATFORMS = new Set(['win32', 'darwin', 'linux']);
const SOURCE_TYPES = new Set(['desktop', 'x11', 'pipewire', 'avfoundation']);
const CODECS = Object.freeze({h264: 'libx264', vp9: 'libvpx-vp9', av1: 'libaom-av1'});

function positiveInteger(value, name, fallback, maximum) { const result = Number.isInteger(value) ? value : fallback; if (result < 1 || result > maximum) throw new RangeError(`${name} must be between 1 and ${maximum}`); return result; }
function required(value, name) { if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`); return value.trim(); }

export function listCaptureBackends(platform, tool = 'ffmpeg') {
  if (!PLATFORMS.has(platform) || tool !== 'ffmpeg') return Object.freeze([]);
  const sourceTypes = platform === 'linux' ? ['x11', 'pipewire'] : platform === 'darwin' ? ['avfoundation'] : ['desktop'];
  return Object.freeze(sourceTypes.map(sourceType => Object.freeze({tool, platform, sourceType, status: 'plan-only', requires: platform === 'darwin' ? ['screen-recording-permission'] : platform === 'linux' && sourceType === 'pipewire' ? ['pipewire', 'portal-permission'] : []})));
}

export function validateCapturePermission({platform, sourceType, environment = {}} = {}) {
  if (!PLATFORMS.has(platform) || !SOURCE_TYPES.has(sourceType)) return Object.freeze({allowed: false, reason: 'Unsupported capture platform or source'});
  if (platform === 'linux' && sourceType === 'x11' && !environment.DISPLAY) return Object.freeze({allowed: false, reason: 'DISPLAY is not set'});
  if (platform === 'linux' && sourceType === 'pipewire' && !environment.WAYLAND_DISPLAY && !environment.XDG_RUNTIME_DIR) return Object.freeze({allowed: false, reason: 'PipeWire session environment is not available'});
  if (platform === 'darwin' && environment.screenRecordingGranted !== true) return Object.freeze({allowed: false, reason: 'Screen Recording permission is not granted'});
  return Object.freeze({allowed: true, reason: 'Environment permits a capture attempt'});
}

export function createCapturePlan({platform, sourceType, source, width = 1920, height = 1080, framerate = 60, audio = false, environment = {}} = {}) {
  required(source, 'source');
  if (!PLATFORMS.has(platform) || !SOURCE_TYPES.has(sourceType)) throw new TypeError('unsupported capture platform or source');
  const permission = validateCapturePermission({platform, sourceType, environment}); if (!permission.allowed) throw new Error(permission.reason);
  const size = `${positiveInteger(width, 'width', 1920, 7680)}x${positiveInteger(height, 'height', 1080, 4320)}`;
  const fps = positiveInteger(framerate, 'framerate', 60, 240); const args = ['-hide_banner', '-loglevel', 'warning'];
  if (platform === 'linux' && sourceType === 'x11') args.push('-f', 'x11grab', '-video_size', size, '-framerate', String(fps), '-i', source);
  else if (platform === 'linux' && sourceType === 'pipewire') args.push('-f', 'pipewire', '-framerate', String(fps), '-i', source);
  else if (platform === 'darwin') args.push('-f', 'avfoundation', '-framerate', String(fps), '-video_size', size, '-i', audio ? `${source}:default` : `${source}:none`);
  else args.push('-f', 'gdigrab', '-framerate', String(fps), '-video_size', size, '-i', source);
  return Object.freeze({kind: 'capture', platform, sourceType, permission, process: createProcessLaunchPlan({executable: 'ffmpeg', args}), output: Object.freeze({container: 'matroska', target: 'stdout', requiresPublisher: true, audio})});
}

export function createEncoderPlan({codec = 'h264', width = 1920, height = 1080, framerate = 60, bitrateKbps = 10000, preferHardware = true} = {}) {
  if (!CODECS[codec]) throw new TypeError(`unsupported encoder codec: ${codec}`);
  const fps = positiveInteger(framerate, 'framerate', 60, 240); const boundedBitrate = positiveInteger(bitrateKbps, 'bitrateKbps', 10000, 1000000);
  const encoder = CODECS[codec]; const args = ['-f', 'matroska', '-i', 'pipe:0', '-c:v', encoder, '-b:v', `${boundedBitrate}k`, '-maxrate', `${boundedBitrate}k`, '-bufsize', `${boundedBitrate * 2}k`, '-r', String(fps), '-g', String(fps * 2), '-f', 'matroska', 'pipe:1'];
  return Object.freeze({kind: 'encoder', codec, width: positiveInteger(width, 'width', 1920, 7680), height: positiveInteger(height, 'height', 1080, 4320), framerate: fps, bitrateKbps: boundedBitrate, preference: preferHardware ? 'hardware-when-platform-adapter-provides-it' : 'software', process: createProcessLaunchPlan({executable: 'ffmpeg', args}), requires: Object.freeze(preferHardware ? ['platform-encoder-selection', 'webrtc-publisher'] : ['webrtc-publisher'])});
}
