const PROTOCOL = 'spartan-gaming/1';
const DEFAULT_CAPABILITIES = Object.freeze({
  transports: ['webrtc', 'websocket'],
  video: {codecs: ['av1', 'vp9', 'h264'], maxWidth: 3840, maxHeight: 2160, maxFramerate: 144, hdr: false},
  audio: {codecs: ['opus', 'aac'], channels: 2},
  input: {gamepad: true, keyboard: true, pointer: true, rumble: true},
});

const transitions = Object.freeze({
  idle: ['preparing'], preparing: ['negotiating', 'error'], negotiating: ['connected', 'reconnecting', 'error'],
  connected: ['reconnecting', 'closing', 'error'], reconnecting: ['negotiating', 'connected', 'closing', 'error'],
  closing: ['closed'], closed: ['preparing'], error: ['preparing', 'closed'],
});

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function intersect(preferred, offered) { return preferred.filter(item => offered.includes(item)); }
function requiredString(value, name) { if (typeof value !== 'string' || !value) throw new TypeError(`${name} must be a non-empty string`); }

export function normalizeCapabilities(capabilities = {}) {
  const merged = {
    ...clone(DEFAULT_CAPABILITIES), ...capabilities,
    video: {...DEFAULT_CAPABILITIES.video, ...(capabilities.video || {})},
    audio: {...DEFAULT_CAPABILITIES.audio, ...(capabilities.audio || {})},
    input: {...DEFAULT_CAPABILITIES.input, ...(capabilities.input || {})},
  };
  if (!Array.isArray(merged.transports) || !merged.transports.length) throw new TypeError('transports must contain at least one value');
  if (!Array.isArray(merged.video.codecs) || !merged.video.codecs.length) throw new TypeError('video.codecs must contain at least one value');
  if (!Array.isArray(merged.audio.codecs) || !merged.audio.codecs.length) throw new TypeError('audio.codecs must contain at least one value');
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
    input: Object.fromEntries(Object.keys(preferred.input).map(key => [key, Boolean(preferred.input[key] && offered.input[key])])),
  };
}

export function createSessionEnvelope({sessionId, type, payload, sequence = 0, messageId = `msg-${Date.now()}-${sequence}`, sentAt = new Date().toISOString()}) {
  requiredString(sessionId, 'sessionId'); requiredString(type, 'type');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new TypeError('payload must be an object');
  return Object.freeze({protocol: PROTOCOL, messageId, sessionId, type, sentAt, sequence, payload: clone(payload)});
}

export function createSessionManager({clock = () => new Date().toISOString(), idFactory = () => `ses-${Date.now()}`} = {}) {
  let state = 'idle'; let session = null; let sequence = 0;
  const transition = next => { if (!transitions[state].includes(next)) throw new Error(`Invalid session transition: ${state} -> ${next}`); state = next; return state; };
  return {
    get state() { return state; },
    get session() { return session ? clone(session) : null; },
    start({backend, capabilities = DEFAULT_CAPABILITIES} = {}) {
      if (!backend?.id) throw new TypeError('backend.id is required');
      transition('preparing'); session = {id: idFactory(), backendId: backend.id, backendType: backend.backendType, capabilities: normalizeCapabilities(capabilities)}; sequence = 0;
      transition('negotiating');
      return createSessionEnvelope({sessionId: session.id, type: 'session.offer', sequence, sentAt: clock(), payload: {role: 'client', backendId: backend.id, transports: session.capabilities.transports, video: session.capabilities.video, audio: session.capabilities.audio, input: session.capabilities.input}});
    },
    receive(message) {
      if (!session || message?.sessionId !== session.id) throw new Error('Message belongs to another session');
      sequence = Math.max(sequence, Number.isInteger(message.sequence) ? message.sequence : sequence);
      const next = { 'session.answer': 'connected', 'session.reconnect': 'reconnecting', 'session.close': 'closing' }[message.type];
      if (next) { transition(next); if (next === 'closing') transition('closed'); }
      return state;
    },
    close() { if (state === 'connected' || state === 'reconnecting') { transition('closing'); transition('closed'); } return state; },
    reset() { if (state !== 'closed' && state !== 'error') throw new Error('Only closed or error sessions can reset'); session = null; state = 'idle'; sequence = 0; },
  };
}

export function createAdapterRegistry(adapters = []) {
  const byId = new Map();
  for (const adapter of adapters) { requiredString(adapter?.id, 'adapter.id'); if (byId.has(adapter.id)) throw new Error(`duplicate adapter id: ${adapter.id}`); byId.set(adapter.id, Object.freeze({...adapter})); }
  return Object.freeze({list: () => Object.freeze([...byId.values()]), get: id => byId.get(id), register(adapter) { requiredString(adapter?.id, 'adapter.id'); if (byId.has(adapter.id)) throw new Error(`duplicate adapter id: ${adapter.id}`); byId.set(adapter.id, Object.freeze({...adapter})); return byId.get(adapter.id); }});
}
