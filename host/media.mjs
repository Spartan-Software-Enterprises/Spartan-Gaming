import {spawnSync} from 'node:child_process';
import {createProcessLaunchPlan} from './adapters.mjs';

const PLATFORMS = new Set(['win32', 'darwin', 'linux']);
const SOURCE_TYPES = new Set(['desktop', 'x11', 'pipewire', 'avfoundation']);
const CODECS = Object.freeze({h264: 'libx264', vp9: 'libvpx-vp9', av1: 'libaom-av1'});

const SOFTWARE_ENCODERS = Object.freeze({h264: 'libx264', vp9: 'libvpx-vp9', av1: 'libaom-av1'});
const ELEMENTARY_FORMATS = Object.freeze({h264: 'h264', vp9: 'ivf', av1: 'obu'});
const HARDWARE_ENCODERS = Object.freeze({
  linux: Object.freeze({h264: ['h264_vaapi', 'h264_nvenc', 'h264_qsv', 'h264_v4l2m2m'], vp9: ['vp9_vaapi', 'vp9_qsv'], av1: ['av1_vaapi', 'av1_nvenc', 'av1_qsv']}),
  win32: Object.freeze({h264: ['h264_nvenc', 'h264_qsv', 'h264_amf', 'h264_mf'], vp9: ['vp9_qsv', 'vp9_nvenc'], av1: ['av1_nvenc', 'av1_qsv', 'av1_amf']}),
  darwin: Object.freeze({h264: ['h264_videotoolbox'], vp9: ['vp9_videotoolbox'], av1: ['av1_videotoolbox']}),
});
const VAAPI_DEVICE = Object.freeze(['/dev/dri/renderD128', '/dev/dri/renderD129']);

function commandOutputProbe(command, args, options) {
  try {
    const result = spawnSync(command, args, {encoding: 'utf8', windowsHide: true, ...options});
    return result?.error ? null : String(result.stdout || '');
  } catch {
    return null;
  }
}

/** Parse `ffmpeg -encoders` output into the set of encoder names FFmpeg exposes. */
export function listFfmpegEncoders(output) {
  if (typeof output !== 'string' || !output) return Object.freeze([]);
  const encoders = [];
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^\s*[VAS]\S*\s+(?<name>[A-Za-z0-9_.-]+)\s+/);
    if (match?.groups?.name) encoders.push(match.groups.name);
  }
  return Object.freeze([...new Set(encoders)]);
}

/** Probe FFmpeg once and return a predicate that confirms a named encoder is present. */
export function createFfmpegEncoderProbe({command = 'ffmpeg', run = commandOutputProbe} = {}) {
  let cached = null;
  return encoder => {
    if (cached === null) cached = listFfmpegEncoders(run(command, ['-hide_banner', '-encoders'], {stdio: 'pipe'}));
    return cached.includes(encoder);
  };
}

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

function probeEncoders(probe = null, platform = null, codec = null) {
  if (typeof probe !== 'function') return null;
  const candidates = platform && HARDWARE_ENCODERS[platform]?.[codec] ? HARDWARE_ENCODERS[platform][codec] : [];
  return Object.freeze(candidates.filter(encoder => probe(encoder) === true));
}

/** Select a hardware encoder for a codec/platform when an injected probe confirms availability. */
export function selectHardwareEncoder({codec = 'h264', platform = null, probe = null, device = null} = {}) {
  if (!CODECS[codec] || !platform || !HARDWARE_ENCODERS[platform]) return null;
  const available = probeEncoders(probe, platform, codec);
  if (!available?.length) return null;
  const encoder = available[0];
  const devicePath = device || (encoder === 'h264_vaapi' || encoder === 'vp9_vaapi' || encoder === 'av1_vaapi' ? VAAPI_DEVICE.find(candidate => probe?.(candidate) !== false) || VAAPI_DEVICE[0] : null);
  return Object.freeze({encoder, platform, device: devicePath, available: Object.freeze(available)});
}

export function createEncoderPlan({codec = 'h264', width = 1920, height = 1080, framerate = 60, bitrateKbps = 10000, preferHardware = true, platform = null, probe = null, device = null, outputFormat = ELEMENTARY_FORMATS[codec]} = {}) {
  if (!CODECS[codec]) throw new TypeError(`unsupported encoder codec: ${codec}`);
  const fps = positiveInteger(framerate, 'framerate', 60, 240); const boundedBitrate = positiveInteger(bitrateKbps, 'bitrateKbps', 10000, 1000000);
  const selected = preferHardware ? selectHardwareEncoder({codec, platform, probe, device}) : null;
  const encoder = selected?.encoder || SOFTWARE_ENCODERS[codec];
  const args = ['-f', 'matroska', '-i', 'pipe:0'];
  if (selected?.device) args.push('-vaapi_device', selected.device);
  args.push('-c:v', encoder, '-b:v', `${boundedBitrate}k`, '-maxrate', `${boundedBitrate}k`, '-bufsize', `${boundedBitrate * 2}k`, '-r', String(fps), '-g', String(fps * 2));
  if (selected?.encoder.includes('vaapi')) args.push('-vf', 'format=nv12,hwupload');
  else if (encoder === 'libx264') args.push('-tune', 'zerolatency', '-preset', 'ultrafast');
  else if (encoder === 'libvpx-vp9') args.push('-tune', 'zerolatency', '-deadline', 'realtime');
  args.push('-f', outputFormat, 'pipe:1');
  const hardware = Boolean(selected);
  return Object.freeze({kind: 'encoder', codec, outputFormat, width: positiveInteger(width, 'width', 1920, 7680), height: positiveInteger(height, 'height', 1080, 4320), framerate: fps, bitrateKbps: boundedBitrate, preference: hardware ? 'hardware' : preferHardware ? 'hardware-when-platform-adapter-provides-it' : 'software', hardware, encoder, device: selected?.device || null, availableEncoders: selected?.available || Object.freeze([]), process: createProcessLaunchPlan({executable: 'ffmpeg', args}), requires: Object.freeze(hardware ? ['hardware-encoder-device', 'webrtc-publisher'] : preferHardware ? ['platform-encoder-selection', 'webrtc-publisher'] : ['webrtc-publisher'])});
}
