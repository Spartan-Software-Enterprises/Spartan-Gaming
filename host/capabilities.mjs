import {normalizePublisherCapabilities} from './publisher.mjs';
import {normalizeInputAdapterCapabilities} from './input.mjs';
import {normalizeAudioCapabilities} from './audio.mjs';

const MEDIA_STATES = new Set(['not-configured', 'ready', 'negotiating', 'active']);
const PROCESS_MODES = new Set(['none', 'user-selected', 'managed']);

function list(value, fallback) { return Array.isArray(value) && value.length ? [...new Set(value.map(String))] : [...fallback]; }

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
    audioPublisher: normalizeAudioCapabilities(capabilities.audioPublisher),
    inputAdapter: normalizeInputAdapterCapabilities(capabilities.inputAdapter),
    input: Object.freeze({gamepad: capabilities.input?.gamepad !== false, keyboard: capabilities.input?.keyboard !== false, pointer: capabilities.input?.pointer !== false, rumble: Boolean(capabilities.input?.rumble), hid: Boolean(capabilities.input?.hid)}),
  });
}

export function hostMediaReady(capabilities) { const normalized = normalizeHostCapabilities(capabilities); return normalized.media.state === 'ready' || normalized.media.state === 'active'; }
