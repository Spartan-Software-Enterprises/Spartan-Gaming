import {normalizePublisherCapabilities} from './publisher.mjs';
import {normalizeInputAdapterCapabilities} from './input.mjs';
import {normalizeAudioCapabilities} from './audio.mjs';

const MEDIA_STATES = new Set(['not-configured', 'ready', 'negotiating', 'active']);
const PROCESS_MODES = new Set(['none', 'user-selected', 'managed']);
const WEBRTC_ADAPTER_STATES = new Set(['available', 'unavailable']);
const VIDEO_CODECS = new Set(['h264', 'vp9', 'av1']);
const VIDEO_CODEC_ORDER = ['av1', 'vp9', 'h264'];

function list(value, fallback) { return Array.isArray(value) && value.length ? [...new Set(value.map(String))] : [...fallback]; }
function normalizeWebRtcAdapters(value) { return Object.freeze((Array.isArray(value) ? value : []).filter(adapter => adapter && typeof adapter.id === 'string' && WEBRTC_ADAPTER_STATES.has(adapter.state)).map(adapter => Object.freeze({id: adapter.id, state: adapter.state}))); }
function boundedInteger(value, fallback, minimum, maximum) { const number = Number.isInteger(Number(value)) ? Number(value) : fallback; return Math.max(minimum, Math.min(maximum, number)); }

/**
 * Resolve the video block a host should advertise. Software FFmpeg always
 * covers H.264 and VP9; AV1 is advertised only when a confirmed hardware
 * encoder is available, since software AV1 is not realtime-viable. A display
 * probe can cap resolution and refresh rate to what the output can actually
 * deliver. HDR stays false unless explicitly enabled and supported.
 */
export function resolveHostVideoCapabilities({encoders = [], maxWidth = 3840, maxHeight = 2160, maxFramerate = 144, hdr = false, display = null} = {}) {
  const hardware = Object.freeze((Array.isArray(encoders) ? encoders : []).filter(entry => entry && VIDEO_CODECS.has(String(entry.codec))).map(entry => Object.freeze({codec: String(entry.codec), encoder: String(entry.encoder), device: entry.device ? String(entry.device) : null})));
  const hardwareCodecs = new Set(hardware.map(entry => entry.codec));
  const codecs = Object.freeze(VIDEO_CODEC_ORDER.filter(codec => codec === 'h264' || codec === 'vp9' || hardwareCodecs.has(codec)));
  const width = boundedInteger(display?.width ?? display?.maxWidth, maxWidth, 320, 7680);
  const height = boundedInteger(display?.height ?? display?.maxHeight, maxHeight, 240, 4320);
  const observedRate = display?.maxRefreshRate;
  const framerate = boundedInteger(observedRate ? Math.min(observedRate, maxFramerate) : maxFramerate, 144, 24, 240);
  const hdrSupported = display === null || display?.hdr === true;
  return Object.freeze({codecs, maxWidth: width, maxHeight: height, maxFramerate: framerate, hdr: Boolean(hdr) && hdrSupported, hardware});
}

export function normalizeHostCapabilities(capabilities = {}) {
  const media = capabilities.media || {};
  const process = capabilities.process || {};
  const state = MEDIA_STATES.has(media.state) ? media.state : 'not-configured';
  const processMode = PROCESS_MODES.has(process.mode) ? process.mode : 'none';
  return Object.freeze({
    version: 1,
    media: Object.freeze({state, capture: Boolean(media.capture), encode: Boolean(media.encode), audio: Boolean(media.audio), transports: list(media.transports, ['webrtc'])}),
    process: Object.freeze({mode: processMode, launch: Boolean(process.launch), emulator: Boolean(process.emulator)}),
    publisher: normalizePublisherCapabilities(capabilities.publisher),
    webrtc: Object.freeze({adapters: normalizeWebRtcAdapters(capabilities.webrtc?.adapters), ready: normalizeWebRtcAdapters(capabilities.webrtc?.adapters).some(adapter => adapter.state === 'available')}),
    audioPublisher: normalizeAudioCapabilities(capabilities.audioPublisher),
    inputAdapter: normalizeInputAdapterCapabilities(capabilities.inputAdapter),
    input: Object.freeze({gamepad: capabilities.input?.gamepad !== false, virtualGamepad: Boolean(capabilities.input?.virtualGamepad ?? capabilities.input?.gamepad), keyboard: capabilities.input?.keyboard !== false, pointer: capabilities.input?.pointer !== false, rumble: Boolean(capabilities.input?.rumble), hid: Boolean(capabilities.input?.hid)}),
  });
}

export function hostMediaReady(capabilities) { const normalized = normalizeHostCapabilities(capabilities); return normalized.media.state === 'ready' || normalized.media.state === 'active'; }
