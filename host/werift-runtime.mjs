import {negotiateHostOffer} from './session.mjs';
import {createSessionEnvelope, normalizeCapabilities} from '../src/frontend/session/session.mjs';
import {validateTransportMessage} from '../src/frontend/transport/transport.mjs';
import {normalizeHostLaunchRequest} from './launch-request.mjs';

const DEFAULT_HOST_CAPABILITIES = Object.freeze({
  transports: ['webrtc'],
  video: {codecs: ['h264'], maxWidth: 3840, maxHeight: 2160, maxFramerate: 144, hdr: false},
  audio: {codecs: ['opus'], channels: 2},
  input: {gamepad: true, keyboard: true, pointer: true, rumble: true},
});

function events() {
  const listeners = new Map();
  return {
    on(type, handler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); return () => listeners.get(type)?.delete(handler); },
    emit(type, value) { for (const handler of listeners.get(type) || []) handler(value); },
  };
}

function required(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}

function advertisedCapabilities(capabilities, mediaState, audio = false) {
  return Object.freeze({...normalizeCapabilities(capabilities), media: Object.freeze({state: mediaState, capture: true, encode: true, audio: Boolean(audio), transport: 'webrtc'})});
}

export function createWeriftHostRuntime({
  signaling,
  sessionFactory,
  sessionId,
  hostId = 'werift-host',
  hostName = 'Werift Host',
  capabilities = DEFAULT_HOST_CAPABILITIES,
  audioEnabled = false,
  onInput = () => {},
  onLaunch = () => {},
  onQuality = () => {},
  clock = () => new Date().toISOString(),
} = {}) {
  if (!signaling || typeof signaling.connect !== 'function' || typeof signaling.send !== 'function' || typeof signaling.on !== 'function') throw new TypeError('signaling transport is required');
  if (typeof sessionFactory !== 'function') throw new TypeError('sessionFactory is required');
  const id = required(sessionId, 'sessionId');
  const local = normalizeCapabilities(capabilities);
  const bus = events();
  const unbind = [];
  let state = 'idle';
  let activeSessionId = null;
  let sequence = 0;
  let mediaSession = null;

  const send = (type, payload) => {
    const message = createSessionEnvelope({sessionId: activeSessionId || id, type, payload, sequence: ++sequence, sentAt: clock()});
    signaling.send(message);
    return message;
  };

  const close = () => {
    if (state === 'closed') return;
    unbind.splice(0).forEach(off => off?.());
    void mediaSession?.close?.();
    signaling.close?.();
    state = 'closed';
    bus.emit('closed');
  };

  const handle = async raw => {
    let message;
    try { message = validateTransportMessage(raw); } catch (error) { bus.emit('error', error); return; }
    if (message.sessionId !== id && message.sessionId !== activeSessionId) return;
    try {
      if (message.type === 'session.offer' && !activeSessionId) {
        if (!message.payload?.sdp) throw new Error('Werift host requires an SDP offer');
        const launch = message.payload.launch === undefined ? null : normalizeHostLaunchRequest(message.payload.launch);
        const negotiation = negotiateHostOffer({offer: message.payload, hostCapabilities: local});
        if (!negotiation.accepted) { send('session.answer', {accepted: false, hostId, hostName, reason: negotiation.reason}); bus.emit('rejected', negotiation.reason); return; }
        activeSessionId = message.sessionId;
        const candidateHandler = candidate => { if (activeSessionId) send('session.ice-candidate', {candidate}); };
        try {
          onLaunch(launch);
          mediaSession = await sessionFactory({onIceCandidate: candidateHandler, onStateChange: mediaState => bus.emit('media.state', mediaState), launch});
          if (!mediaSession || typeof mediaSession.acceptOffer !== 'function' || typeof mediaSession.addIceCandidate !== 'function') throw new TypeError('sessionFactory must return a Werift session');
          const answer = await mediaSession.acceptOffer(message.payload.sdp);
          state = 'connected';
          send('session.answer', {accepted: true, hostId, hostName, capabilities: negotiation.capabilities, hostCapabilities: advertisedCapabilities(local, 'active', audioEnabled), sdp: answer});
          bus.emit('connected', {sessionId: activeSessionId, capabilities: negotiation.capabilities});
          return;
        } catch (error) {
          try { await mediaSession?.close?.(); } catch { /* rollback must not mask the original offer failure */ }
          mediaSession = null;
          activeSessionId = null;
          throw error;
        }
      }
      if (message.sessionId !== activeSessionId) return;
      if (message.type === 'session.ice-candidate') { await mediaSession?.addIceCandidate(message.payload.candidate); return; }
      if (message.type === 'input.event') { onInput(message.payload); bus.emit('input', message.payload); return; }
      if (message.type === 'quality.request') { onQuality(message.payload); bus.emit('quality', message.payload); return; }
      if (message.type === 'session.reconnect') { send('session.answer', {accepted: true, hostId, hostName, capabilities: negotiationCapabilities(), hostCapabilities: advertisedCapabilities(local, 'active', audioEnabled)}); return; }
      if (message.type === 'session.close') close();
    } catch (error) { state = 'error'; bus.emit('error', error); }
  };

  const negotiationCapabilities = () => ({transports: [local.transports[0]], video: {codec: local.video.codecs[0], maxWidth: local.video.maxWidth, maxHeight: local.video.maxHeight, maxFramerate: local.video.maxFramerate, hdr: local.video.hdr}, audio: {codec: local.audio.codecs[0], channels: local.audio.channels}, input: {...local.input}});

  const runtime = {
    get state() { return state; },
    get sessionId() { return activeSessionId; },
    get mediaSession() { return mediaSession; },
    on: bus.on,
    async start() {
      if (state !== 'idle') throw new Error('Werift host runtime is already started');
      unbind.push(signaling.on('message', handle));
      unbind.push(signaling.on('error', error => bus.emit('error', error)));
      unbind.push(signaling.on('close', event => { state = 'closed'; bus.emit('close', event); }));
      await signaling.connect();
      state = 'listening';
      bus.emit('listening');
    },
    close,
  };
  return Object.freeze(runtime);
}
