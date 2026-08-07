import {parseHostEndpoint} from '../host/host.mjs';
import {createIceConfiguration} from './ice.mjs';

const VALID_MESSAGE_TYPES = new Set(['session.offer', 'session.answer', 'session.ice-candidate', 'session.reconnect', 'input.event', 'quality.request', 'telemetry.health', 'session.close']);

function required(value, name) { if (!value) throw new TypeError(`${name} is required`); return value; }
function events() { const listeners = new Map(); return {on(type, handler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); return () => listeners.get(type)?.delete(handler); }, emit(type, payload) { for (const handler of listeners.get(type) || []) handler(payload); }}; }

export function validateTransportMessage(message) {
  if (!message || message.protocol !== 'spartan-gaming/1' || typeof message.messageId !== 'string' || typeof message.sessionId !== 'string' || !VALID_MESSAGE_TYPES.has(message.type) || !message.payload || typeof message.payload !== 'object') throw new TypeError('invalid Spartan Gaming transport message');
  return message;
}

export function createWebSocketSignalTransport({endpoint, join, WebSocketImpl = globalThis.WebSocket} = {}) {
  const parsed = parseHostEndpoint(endpoint); if (!['ws:', 'wss:'].includes(parsed.protocol)) throw new TypeError('WebSocket signaling requires a ws or wss endpoint');
  const bus = events(); let socket = null; let state = 'idle'; let connectReject;
  const transport = {
    get state() { return state; }, on: bus.on,
    connect() {
      if (state === 'open') return Promise.resolve(); if (typeof WebSocketImpl !== 'function') return Promise.reject(new Error('WebSocket is unavailable in this browser'));
    state = 'connecting'; return new Promise((resolve, reject) => { connectReject = reject; socket = new WebSocketImpl(parsed.url); socket.onopen = () => { if (join) { if (typeof join.sessionId !== 'string' || typeof join.role !== 'string' || typeof join.ticket !== 'string') { state = 'error'; const error = new TypeError('signaling join requires sessionId, role, and ticket'); bus.emit('error', error); reject(error); return; } socket.send(JSON.stringify({type: 'signaling.join', sessionId: join.sessionId, role: join.role, ticket: join.ticket})); } state = 'open'; connectReject = undefined; bus.emit('open'); resolve(); }; socket.onmessage = event => { try { bus.emit('message', validateTransportMessage(JSON.parse(typeof event.data === 'string' ? event.data : String(event.data)))); } catch (error) { bus.emit('error', error); } }; socket.onerror = error => { state = 'error'; bus.emit('error', error); if (connectReject) { connectReject(error instanceof Error ? error : new Error('WebSocket connection failed')); connectReject = undefined; } }; socket.onclose = event => { state = 'closed'; bus.emit('close', event); }; });
    },
    send(message) { if (state !== 'open' || !socket) throw new Error('WebSocket signaling transport is not open'); socket.send(JSON.stringify(validateTransportMessage(message))); },
    close(code = 1000, reason = 'client closed') { socket?.close(code, reason); state = 'closed'; },
  };
  return Object.freeze(transport);
}

export function createWebRtcTransport({RTCPeerConnectionImpl = globalThis.RTCPeerConnection, configuration = {}, ice, dataChannelLabel = 'spartan-control'} = {}) {
  if (typeof RTCPeerConnectionImpl !== 'function') throw new Error('RTCPeerConnection is unavailable in this browser');
  const bus = events(); const peer = new RTCPeerConnectionImpl(ice ? {...createIceConfiguration(ice), ...configuration} : configuration); let state = 'new';
  peer.onicecandidate = event => { if (event.candidate) bus.emit('icecandidate', event.candidate); };
  peer.ontrack = event => bus.emit('track', event);
  const transport = {
    get state() { return state; }, on: bus.on,
    createDataChannel(label = dataChannelLabel) { return peer.createDataChannel(label); },
    async createOffer(options) { state = 'negotiating'; const offer = await peer.createOffer(options); await peer.setLocalDescription(offer); return peer.localDescription || offer; },
    async acceptAnswer(answer) { required(answer, 'answer'); await peer.setRemoteDescription(answer); state = 'connected'; bus.emit('connected'); },
    addIceCandidate(candidate) { return peer.addIceCandidate(candidate); },
    close() { peer.close(); state = 'closed'; bus.emit('close'); },
    get peerConnection() { return peer; },
  };
  return Object.freeze(transport);
}
