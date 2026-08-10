import {createQualityController} from './quality.mjs';
import {createReconnectPolicy} from './recovery.mjs';

const PROTOCOL = 'spartan-gaming/1';
const DEFAULT_CAPABILITIES = Object.freeze({
  transports: ['webrtc', 'websocket'],
  video: {codecs: ['av1', 'vp9', 'h264'], maxWidth: 3840, maxHeight: 2160, maxFramerate: 144, hdr: false},
  audio: {codecs: ['opus', 'aac'], channels: 2},
  input: {gamepad: true, keyboard: true, pointer: true, rumble: true, hid: false, adaptiveTriggers: false, gyro: false, multipleControllers: true, playerSlots: 4, inputMode: 'Auto-detect', virtualGamepadBackend: 'Automatic', hapticsBackend: 'Automatic', touchpad: false, trackpads: false, backButtons: false, touchscreen: false, textEntry: true, controllerNavigation: true, triggerMode: 'Analog and digital', steeringRange: 900, splitInput: false},
});

const transitions = Object.freeze({
  idle: ['preparing'], preparing: ['negotiating', 'error', 'closing'], negotiating: ['connected', 'reconnecting', 'error', 'closing'],
  connected: ['reconnecting', 'closing', 'error'], reconnecting: ['negotiating', 'connected', 'closing', 'error'],
  closing: ['closed'], closed: ['preparing'], error: ['preparing', 'closed'],
});

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function intersect(preferred, offered) { return preferred.filter(item => offered.includes(item)); }
function requiredString(value, name) { if (typeof value !== 'string' || !value) throw new TypeError(`${name} must be a non-empty string`); }
function boundedInteger(value, fallback, maximum, name) { const result = value === undefined ? fallback : value; if (!Number.isInteger(result) || result < 1 || result > maximum) throw new TypeError(`${name} must be an integer between 1 and ${maximum}`); return result; }
function stringList(value, fallback, name) { const result = value === undefined ? fallback : value; if (!Array.isArray(result) || !result.length || result.some(item => typeof item !== 'string' || !item)) throw new TypeError(`${name} must contain non-empty strings`); return [...new Set(result)]; }
function option(value, choices, fallback, name) { const result = value === undefined ? fallback : value; if (!choices.includes(result)) throw new TypeError(`${name} must be one of ${choices.join(', ')}`); return result; }

export function normalizeCapabilities(capabilities = {}) {
  const merged = {
    ...clone(DEFAULT_CAPABILITIES), ...capabilities,
    video: {...DEFAULT_CAPABILITIES.video, ...(capabilities.video || {})},
    audio: {...DEFAULT_CAPABILITIES.audio, ...(capabilities.audio || {})},
    input: {...DEFAULT_CAPABILITIES.input, ...(capabilities.input || {})},
  };
  merged.transports = stringList(merged.transports, DEFAULT_CAPABILITIES.transports, 'transports');
  merged.video.codecs = stringList(merged.video.codecs, DEFAULT_CAPABILITIES.video.codecs, 'video.codecs');
  merged.video.maxWidth = boundedInteger(merged.video.maxWidth, DEFAULT_CAPABILITIES.video.maxWidth, 16384, 'video.maxWidth');
  merged.video.maxHeight = boundedInteger(merged.video.maxHeight, DEFAULT_CAPABILITIES.video.maxHeight, 8640, 'video.maxHeight');
  merged.video.maxFramerate = boundedInteger(merged.video.maxFramerate, DEFAULT_CAPABILITIES.video.maxFramerate, 240, 'video.maxFramerate');
  merged.audio.codecs = stringList(merged.audio.codecs, DEFAULT_CAPABILITIES.audio.codecs, 'audio.codecs');
  merged.audio.channels = boundedInteger(merged.audio.channels, DEFAULT_CAPABILITIES.audio.channels, 8, 'audio.channels');
  merged.video.hdr = Boolean(merged.video.hdr);
  merged.input.gamepad = Boolean(merged.input.gamepad); merged.input.keyboard = Boolean(merged.input.keyboard); merged.input.pointer = Boolean(merged.input.pointer); merged.input.rumble = Boolean(merged.input.rumble); merged.input.hid = Boolean(merged.input.hid); merged.input.adaptiveTriggers = Boolean(merged.input.adaptiveTriggers); merged.input.gyro = Boolean(merged.input.gyro); merged.input.multipleControllers = Boolean(merged.input.multipleControllers); merged.input.playerSlots = boundedInteger(merged.input.playerSlots, DEFAULT_CAPABILITIES.input.playerSlots, 8, 'input.playerSlots'); merged.input.inputMode = option(merged.input.inputMode, ['Auto-detect', 'XInput', 'DirectInput', 'Standard Gamepad', 'HID passthrough'], DEFAULT_CAPABILITIES.input.inputMode, 'input.inputMode'); merged.input.virtualGamepadBackend = option(merged.input.virtualGamepadBackend, ['Automatic', 'Browser Gamepad', 'Linux uinput', 'Windows external driver', 'macOS external driver', 'Disabled'], DEFAULT_CAPABILITIES.input.virtualGamepadBackend, 'input.virtualGamepadBackend'); merged.input.hapticsBackend = option(merged.input.hapticsBackend, ['Automatic', 'Browser vibration', 'Native rumble', 'Disabled'], DEFAULT_CAPABILITIES.input.hapticsBackend, 'input.hapticsBackend'); merged.input.touchpad = Boolean(merged.input.touchpad); merged.input.trackpads = Boolean(merged.input.trackpads); merged.input.backButtons = Boolean(merged.input.backButtons); merged.input.touchscreen = Boolean(merged.input.touchscreen); merged.input.textEntry = Boolean(merged.input.textEntry); merged.input.controllerNavigation = Boolean(merged.input.controllerNavigation); merged.input.triggerMode = option(merged.input.triggerMode, ['Analog and digital', 'Analog only', 'Digital only'], DEFAULT_CAPABILITIES.input.triggerMode, 'input.triggerMode'); merged.input.steeringRange = Math.max(90, Math.min(1080, Number(merged.input.steeringRange) || DEFAULT_CAPABILITIES.input.steeringRange)); merged.input.splitInput = Boolean(merged.input.splitInput);
  return merged;
}

export function negotiateCapabilities(local, remote) {
  const preferred = normalizeCapabilities(local);
  const offered = normalizeCapabilities(remote);
  const transports = intersect(preferred.transports, offered.transports);
  const videoCodecs = intersect(preferred.video.codecs, offered.video.codecs);
  const audioCodecs = intersect(preferred.audio.codecs, offered.audio.codecs);
  if (!transports.length) throw new Error('No compatible session transport');
  if (!videoCodecs.length) throw new Error('No compatible video codec');
  if (!audioCodecs.length) throw new Error('No compatible audio codec');
  return {
    transports: [transports[0]],
    video: {codec: videoCodecs[0], maxWidth: Math.min(preferred.video.maxWidth, offered.video.maxWidth), maxHeight: Math.min(preferred.video.maxHeight, offered.video.maxHeight), maxFramerate: Math.min(preferred.video.maxFramerate, offered.video.maxFramerate), hdr: Boolean(preferred.video.hdr && offered.video.hdr)},
    audio: {codec: audioCodecs[0], channels: Math.min(preferred.audio.channels, offered.audio.channels)},
    input: {gamepad: Boolean(preferred.input.gamepad && offered.input.gamepad), keyboard: Boolean(preferred.input.keyboard && offered.input.keyboard), pointer: Boolean(preferred.input.pointer && offered.input.pointer), rumble: Boolean(preferred.input.rumble && offered.input.rumble), hid: Boolean(preferred.input.hid && offered.input.hid), adaptiveTriggers: Boolean(preferred.input.adaptiveTriggers && offered.input.adaptiveTriggers), gyro: Boolean(preferred.input.gyro && offered.input.gyro), multipleControllers: Boolean(preferred.input.multipleControllers && offered.input.multipleControllers), playerSlots: Math.min(preferred.input.playerSlots, offered.input.playerSlots), inputMode: preferred.input.inputMode === offered.input.inputMode ? preferred.input.inputMode : 'Auto-detect', virtualGamepadBackend: preferred.input.virtualGamepadBackend === offered.input.virtualGamepadBackend ? preferred.input.virtualGamepadBackend : 'Automatic', hapticsBackend: preferred.input.hapticsBackend === offered.input.hapticsBackend ? preferred.input.hapticsBackend : 'Automatic', touchpad: Boolean(preferred.input.touchpad && offered.input.touchpad), trackpads: Boolean(preferred.input.trackpads && offered.input.trackpads), backButtons: Boolean(preferred.input.backButtons && offered.input.backButtons), touchscreen: Boolean(preferred.input.touchscreen && offered.input.touchscreen), textEntry: Boolean(preferred.input.textEntry && offered.input.textEntry), controllerNavigation: Boolean(preferred.input.controllerNavigation && offered.input.controllerNavigation), triggerMode: preferred.input.triggerMode === offered.input.triggerMode ? preferred.input.triggerMode : 'Analog and digital', steeringRange: Math.min(preferred.input.steeringRange, offered.input.steeringRange), splitInput: Boolean(preferred.input.splitInput && offered.input.splitInput)},
  };
}

export function createSessionEnvelope({sessionId, type, payload, sequence = 0, messageId = `msg-${Date.now()}-${sequence}`, sentAt = new Date().toISOString()}) {
  requiredString(sessionId, 'sessionId'); requiredString(type, 'type');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new TypeError('payload must be an object');
  return Object.freeze({protocol: PROTOCOL, messageId, sessionId, type, sentAt, sequence, payload: clone(payload)});
}

export function createSessionManager({clock = () => new Date().toISOString(), idFactory = () => `ses-${Date.now()}`} = {}) {
  let state = 'idle'; let session = null; let sequence = 0; let quality = createQualityController(); let recovery = createReconnectPolicy();
  const transition = next => { if (!transitions[state].includes(next)) throw new Error(`Invalid session transition: ${state} -> ${next}`); state = next; return state; };
  return {
    get state() { return state; },
    get session() { return session ? clone(session) : null; },
    get quality() { return quality.profile; },
    get qualityRequest() { return quality.request(); },
    get negotiated() { return session?.negotiated ? clone(session.negotiated) : null; },
    get recovery() { return {attempt: recovery.attempt, exhausted: recovery.exhausted, maxAttempts: recovery.maxAttempts}; },
    start({backend, capabilities = DEFAULT_CAPABILITIES, preferences = {}, launch} = {}) {
      if (!backend?.id) throw new TypeError('backend.id is required');
      transition('preparing'); quality = createQualityController({initialProfile: preferences.qualityPreset || 'balanced', profiles: preferences.qualityProfiles, adaptiveBitrate: preferences.adaptiveBitrate !== false, adaptiveResolution: preferences.adaptiveResolution !== false}); recovery = createReconnectPolicy(); session = {id: idFactory(), backendId: backend.id, backendType: backend.backendType, capabilities: normalizeCapabilities(capabilities), preferences: clone(preferences), negotiated: null, quality: quality.profile}; sequence = 0;
      transition('negotiating');
      const payload = {role: 'client', backendId: backend.id, transports: session.capabilities.transports, video: session.capabilities.video, audio: session.capabilities.audio, input: session.capabilities.input, quality: {...quality.request(), ...(preferences.bitrateKbps ? {bitrateKbps: preferences.bitrateKbps} : {})}, streaming: clone(preferences)};
      if (launch !== undefined) { if (!launch || typeof launch !== 'object' || Array.isArray(launch)) throw new TypeError('launch must be an object'); payload.launch = clone(launch); }
      if (backend.hostId) payload.hostId = backend.hostId;
      if (backend.pairingCode) payload.pairingCode = backend.pairingCode;
      return createSessionEnvelope({sessionId: session.id, type: 'session.offer', sequence, sentAt: clock(), payload});
    },
    setQuality(profileId) { if (!session || !['preparing', 'negotiating', 'connected', 'reconnecting'].includes(state)) throw new Error('Quality can only be changed during an active session'); quality.setProfile(profileId); session.quality = quality.profile; return quality.request(); },
    receive(message) {
      if (!session || message?.sessionId !== session.id) throw new Error('Message belongs to another session');
      sequence = Math.max(sequence, Number.isInteger(message.sequence) ? message.sequence : sequence);
      if (message.type === 'telemetry.health') { const decision = quality.ingest(message.payload); session.quality = decision.profile; return state; }
      if (message.type === 'session.answer') {
        if (message.payload?.accepted !== true) throw new Error('Session answer rejected by host');
        if (message.payload.capabilities) session.negotiated = negotiateCapabilities(session.capabilities, message.payload.capabilities);
      }
      const next = { 'session.answer': 'connected', 'session.reconnect': 'reconnecting', 'session.close': 'closing' }[message.type];
      if (next) { transition(next); if (next === 'connected') recovery.succeeded(); if (next === 'closing') transition('closed'); }
      return state;
    },
    requestReconnect() {
      if (!session || (state !== 'connected' && state !== 'reconnecting')) throw new Error('Only connected sessions can reconnect');
      if (state === 'connected') transition('reconnecting');
      const plan = recovery.next();
      if (plan.exhausted) { transition('error'); throw new Error('Session reconnect attempts exhausted'); }
      sequence += 1;
      return createSessionEnvelope({sessionId: session.id, type: 'session.reconnect', sequence, payload: {attempt: plan.attempt, delayMs: plan.delayMs}});
    },
    close() { if (state === 'preparing' || state === 'negotiating' || state === 'connected' || state === 'reconnecting') { transition('closing'); transition('closed'); } return state; },
    reset() { if (state !== 'closed' && state !== 'error') throw new Error('Only closed or error sessions can reset'); session = null; state = 'idle'; sequence = 0; recovery.reset(); },
  };
}

export function createAdapterRegistry(adapters = []) {
  const byId = new Map();
  for (const adapter of adapters) { requiredString(adapter?.id, 'adapter.id'); if (byId.has(adapter.id)) throw new Error(`duplicate adapter id: ${adapter.id}`); byId.set(adapter.id, Object.freeze({...adapter})); }
  return Object.freeze({list: () => Object.freeze([...byId.values()]), get: id => byId.get(id), register(adapter) { requiredString(adapter?.id, 'adapter.id'); if (byId.has(adapter.id)) throw new Error(`duplicate adapter id: ${adapter.id}`); byId.set(adapter.id, Object.freeze({...adapter})); return byId.get(adapter.id); }});
}
