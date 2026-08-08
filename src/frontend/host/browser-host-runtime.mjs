import {negotiateHostOffer} from '../../../host/session.mjs';
import {createSessionEnvelope, normalizeCapabilities} from '../session/session.mjs';
import {validateTransportMessage} from '../transport/transport.mjs';

const DEFAULT_HOST_CAPABILITIES = Object.freeze({transports: ['webrtc'], video: {codecs: ['vp9', 'h264'], maxWidth: 3840, maxHeight: 2160, maxFramerate: 144, hdr: false}, audio: {codecs: ['opus'], channels: 2}, input: {gamepad: false, keyboard: true, pointer: true, rumble: false}});

function events() { const listeners = new Map(); return {on(type, handler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); return () => listeners.get(type)?.delete(handler); }, emit(type, value) { for (const handler of listeners.get(type) || []) handler(value); }}; }
function required(value, name) { if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`); return value.trim(); }
function hostCapabilities(capabilities, mediaState, audio = false) { return Object.freeze({...normalizeCapabilities(capabilities), media: Object.freeze({state: mediaState, capture: true, encode: true, audio: Boolean(audio), transport: 'webrtc'})}); }

export function createBrowserHostRuntime({signaling, publisher, sessionId, hostId = 'browser-host', hostName = 'Browser Host', capabilities = DEFAULT_HOST_CAPABILITIES, onInput = () => {}, onQuality = () => {}, onControl = () => {}, clock = () => new Date().toISOString()} = {}) {
  if (!signaling || typeof signaling.connect !== 'function' || typeof signaling.send !== 'function' || typeof signaling.on !== 'function') throw new TypeError('signaling transport is required');
  if (!publisher || typeof publisher.acceptOffer !== 'function' || typeof publisher.addIceCandidate !== 'function' || typeof publisher.on !== 'function') throw new TypeError('browser publisher is required');
  const id = required(sessionId, 'sessionId'); const bus = events(); const local = normalizeCapabilities(capabilities); let state = 'idle'; let activeSessionId = null; let sequence = 0; const unbind = [];
  const negotiationCapabilities = () => ({transports: [local.transports[0]], video: {codec: local.video.codecs[0], maxWidth: local.video.maxWidth, maxHeight: local.video.maxHeight, maxFramerate: local.video.maxFramerate, hdr: local.video.hdr}, audio: {codec: local.audio.codecs[0], channels: local.audio.channels}, input: {...local.input}});
  const send = (type, payload) => { const message = createSessionEnvelope({sessionId: activeSessionId || id, type, payload, sequence: ++sequence, sentAt: clock()}); signaling.send(message); return message; };
  const close = () => { if (state === 'closed') return; unbind.splice(0).forEach(off => off?.()); publisher.close?.(); signaling.close?.(); state = 'closed'; bus.emit('closed'); };
  const handle = async raw => {
    let message; try { message = validateTransportMessage(raw); } catch (error) { bus.emit('error', error); return; }
    if (message.sessionId !== id && message.sessionId !== activeSessionId) return;
    try {
      if (message.type === 'session.offer' && !activeSessionId) {
        if (!message.payload?.sdp) throw new Error('Browser host requires an SDP offer');
        const negotiation = negotiateHostOffer({offer: message.payload, hostCapabilities: local});
        if (!negotiation.accepted) { send('session.answer', {accepted: false, hostId, hostName, reason: negotiation.reason}); bus.emit('rejected', negotiation.reason); return; }
        if (!publisher.stream) throw new Error('Capture must be started before accepting a session offer');
        const answer = await publisher.acceptOffer(message.payload.sdp); activeSessionId = message.sessionId; state = 'connected'; const audioEnabled = Boolean(publisher.stream?.getAudioTracks?.().length);
        send('session.answer', {accepted: true, hostId, hostName, capabilities: negotiation.capabilities, hostCapabilities: hostCapabilities(local, 'active', audioEnabled), sdp: answer}); bus.emit('connected', {sessionId: activeSessionId, capabilities: negotiation.capabilities}); return;
      }
      if (message.sessionId !== activeSessionId) return;
      if (message.type === 'session.ice-candidate') { await publisher.addIceCandidate(message.payload.candidate); return; }
      if (message.type === 'input.event') { onInput(message.payload); bus.emit('input', message.payload); return; }
      if (message.type === 'quality.request') { onQuality(message.payload); bus.emit('quality', message.payload); return; }
      if (message.type === 'session.control') { const action = message.payload?.action; if (['pause', 'resume'].includes(action)) publisher.setPaused?.(action === 'pause'); onControl(message.payload); bus.emit('control', message.payload); return; }
      if (message.type === 'session.reconnect') { const audioEnabled = Boolean(publisher.stream?.getAudioTracks?.().length); send('session.answer', {accepted: true, hostId, hostName, capabilities: negotiationCapabilities(), hostCapabilities: hostCapabilities(local, 'active', audioEnabled)}); return; }
      if (message.type === 'session.close') close();
    } catch (error) { state = 'error'; bus.emit('error', error); }
  };
  const runtime = {
    get state() { return state; }, get sessionId() { return activeSessionId; }, on: bus.on,
    async capture(options) { return publisher.capture(options); },
    async start() { if (state !== 'idle') throw new Error('browser host runtime is already started'); unbind.push(signaling.on('message', handle)); unbind.push(signaling.on('error', error => bus.emit('error', error))); unbind.push(signaling.on('close', event => { state = 'closed'; bus.emit('close', event); })); unbind.push(publisher.on('icecandidate', candidate => { if (activeSessionId) send('session.ice-candidate', {candidate}); })); await signaling.connect(); state = 'listening'; bus.emit('listening'); },
    close,
  };
  return Object.freeze(runtime);
}
