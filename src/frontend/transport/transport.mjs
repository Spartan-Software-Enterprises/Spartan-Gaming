import { parseHostEndpoint } from '../host/host.mjs';
import { createIceConfiguration } from './ice.mjs';

const VALID_MESSAGE_TYPES = new Set([
  'session.offer',
  'session.answer',
  'session.ice-candidate',
  'session.reconnect',
  'session.control',
  'input.event',
  'quality.request',
  'telemetry.health',
  'session.close',
]);
const ENVELOPE_FIELDS = new Set([
  'protocol',
  'messageId',
  'sessionId',
  'type',
  'sentAt',
  'sequence',
  'payload',
]);
const IDENTIFIER = /^[A-Za-z0-9._:-]{8,128}$/u;
const RFC3339_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/u;

function required(value, name) {
  if (!value) throw new TypeError(`${name} is required`);
  return value;
}
function events() {
  const listeners = new Map();
  return {
    on(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
      return () => listeners.get(type)?.delete(handler);
    },
    emit(type, payload) {
      for (const handler of listeners.get(type) || []) handler(payload);
    },
  };
}
function validTimestamp(value) {
  const match = typeof value === 'string' ? value.match(RFC3339_TIMESTAMP) : null;
  if (!match) return false;
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  const offsetHour = Number(match[7] || 0);
  const offsetMinute = Number(match[8] || 0);
  const calendar = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return (
    Number.isFinite(Date.parse(value)) &&
    month >= 1 &&
    month <= 12 &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    offsetHour <= 23 &&
    offsetMinute <= 59 &&
    calendar.getUTCFullYear() === year &&
    calendar.getUTCMonth() === month - 1 &&
    calendar.getUTCDate() === day &&
    calendar.getUTCHours() === hour &&
    calendar.getUTCMinutes() === minute &&
    calendar.getUTCSeconds() === second
  );
}

export function applyJitterBufferTarget(receiver, targetMs) {
  if (
    !receiver ||
    (typeof receiver !== 'object' && typeof receiver !== 'function') ||
    !Number.isFinite(targetMs) ||
    !('jitterBufferTarget' in receiver)
  )
    return false;
  const boundedTarget = Math.max(0, Math.min(500, Math.round(targetMs)));
  try {
    receiver.jitterBufferTarget = boundedTarget;
    return receiver.jitterBufferTarget === boundedTarget;
  } catch {
    return false;
  }
}

export function validateTransportMessage(message) {
  if (
    !message ||
    typeof message !== 'object' ||
    Array.isArray(message) ||
    Object.keys(message).some((key) => !ENVELOPE_FIELDS.has(key)) ||
    message.protocol !== 'spartan-gaming/1' ||
    typeof message.messageId !== 'string' ||
    !IDENTIFIER.test(message.messageId) ||
    typeof message.sessionId !== 'string' ||
    !IDENTIFIER.test(message.sessionId) ||
    !VALID_MESSAGE_TYPES.has(message.type) ||
    !validTimestamp(message.sentAt) ||
    !message.payload ||
    typeof message.payload !== 'object' ||
    Array.isArray(message.payload) ||
    (message.sequence !== undefined &&
      (!Number.isSafeInteger(message.sequence) || message.sequence < 0))
  )
    throw new TypeError('invalid Spartan Gaming transport message');
  if (message.type === 'session.control' && !['pause', 'resume'].includes(message.payload.action))
    throw new TypeError('invalid session control action');
  return message;
}

export function createWebSocketSignalTransport({
  endpoint,
  join,
  WebSocketImpl = globalThis.WebSocket,
} = {}) {
  const parsed = parseHostEndpoint(endpoint);
  if (!['ws:', 'wss:'].includes(parsed.protocol))
    throw new TypeError('WebSocket signaling requires a ws or wss endpoint');
  const bus = events();
  let socket = null;
  let state = 'idle';
  let connectReject;
  const transport = {
    get state() {
      return state;
    },
    on: bus.on,
    connect() {
      if (state === 'open') return Promise.resolve();
      if (typeof WebSocketImpl !== 'function')
        return Promise.reject(new Error('WebSocket is unavailable in this browser'));
      state = 'connecting';
      return new Promise((resolve, reject) => {
        connectReject = reject;
        socket = new WebSocketImpl(parsed.url);
        socket.onopen = () => {
          if (join) {
            if (
              typeof join.sessionId !== 'string' ||
              typeof join.role !== 'string' ||
              typeof join.ticket !== 'string'
            ) {
              state = 'error';
              const error = new TypeError('signaling join requires sessionId, role, and ticket');
              bus.emit('error', error);
              reject(error);
              return;
            }
            socket.send(
              JSON.stringify({
                type: 'signaling.join',
                sessionId: join.sessionId,
                role: join.role,
                ticket: join.ticket,
              }),
            );
          }
          state = 'open';
          connectReject = undefined;
          bus.emit('open');
          resolve();
        };
        socket.onmessage = (event) => {
          try {
            bus.emit(
              'message',
              validateTransportMessage(
                JSON.parse(typeof event.data === 'string' ? event.data : String(event.data)),
              ),
            );
          } catch (error) {
            bus.emit('error', error);
          }
        };
        socket.onerror = (error) => {
          state = 'error';
          bus.emit('error', error);
          if (connectReject) {
            connectReject(
              error instanceof Error ? error : new Error('WebSocket connection failed'),
            );
            connectReject = undefined;
          }
        };
        socket.onclose = (event) => {
          state = 'closed';
          bus.emit('close', event);
        };
      });
    },
    send(message) {
      if (state !== 'open' || !socket) throw new Error('WebSocket signaling transport is not open');
      socket.send(JSON.stringify(validateTransportMessage(message)));
    },
    close(code = 1000, reason = 'client closed') {
      socket?.close(code, reason);
      state = 'closed';
    },
  };
  return Object.freeze(transport);
}

export function createWebTransportSignalTransport({
  endpoint,
  join,
  WebTransportImpl = globalThis.WebTransport,
} = {}) {
  const parsed = parseHostEndpoint(endpoint);
  if (parsed.protocol !== 'https:')
    throw new TypeError('WebTransport signaling requires an https endpoint');
  const bus = events();
  let connection = null;
  let writer = null;
  let reader = null;
  let state = 'idle';
  const encode = (value) => new TextEncoder().encode(value);
  const decode = (value) => new TextDecoder().decode(value);
  const validJoin = (value) => {
    if (
      !value ||
      typeof value.sessionId !== 'string' ||
      typeof value.role !== 'string' ||
      typeof value.ticket !== 'string'
    )
      throw new TypeError('signaling join requires sessionId, role, and ticket');
    return value;
  };
  const readLoop = async () => {
    try {
      while (state === 'open') {
        const result = await reader.read();
        if (result.done) break;
        try {
          bus.emit('message', validateTransportMessage(JSON.parse(decode(result.value))));
        } catch (error) {
          bus.emit('error', error);
        }
      }
      if (state === 'open') {
        state = 'closed';
        bus.emit('close');
      }
    } catch (error) {
      if (state !== 'closed') {
        state = 'error';
        bus.emit('error', error);
      }
    }
  };
  const transport = {
    get state() {
      return state;
    },
    on: bus.on,
    async connect() {
      if (state === 'open') return;
      if (typeof WebTransportImpl !== 'function')
        throw new Error('WebTransport is unavailable in this browser');
      state = 'connecting';
      connection = new WebTransportImpl(parsed.url);
      try {
        await connection.ready;
        if (!connection.datagrams?.writable || !connection.datagrams?.readable)
          throw new Error('WebTransport datagrams are unavailable');
        writer = connection.datagrams.writable.getWriter();
        reader = connection.datagrams.readable.getReader();
        if (join)
          await writer.write(
            encode(JSON.stringify({ type: 'signaling.join', ...validJoin(join) })),
          );
        state = 'open';
        bus.emit('open');
        void readLoop();
      } catch (error) {
        state = 'error';
        bus.emit('error', error);
        connection.close?.();
        throw error;
      }
    },
    send(message) {
      if (state !== 'open' || !writer)
        throw new Error('WebTransport signaling transport is not open');
      return writer.write(encode(JSON.stringify(validateTransportMessage(message))));
    },
    close() {
      if (state === 'closed') return;
      state = 'closed';
      reader?.cancel?.();
      writer?.releaseLock?.();
      connection?.close?.();
      bus.emit('close');
    },
  };
  return Object.freeze(transport);
}

export function createWebRtcTransport({
  RTCPeerConnectionImpl = globalThis.RTCPeerConnection,
  configuration = {},
  ice,
  dataChannelLabel = 'spartan-control',
} = {}) {
  if (typeof RTCPeerConnectionImpl !== 'function')
    throw new Error('RTCPeerConnection is unavailable in this browser');
  const bus = events();
  const peer = new RTCPeerConnectionImpl(
    ice ? { ...createIceConfiguration(ice), ...configuration } : configuration,
  );
  let state = 'new';
  peer.onicecandidate = (event) => {
    if (event.candidate) bus.emit('icecandidate', event.candidate);
  };
  peer.ontrack = (event) => bus.emit('track', event);
  peer.ondatachannel = (event) => bus.emit('datachannel', event.channel);
  const transport = {
    get state() {
      return state;
    },
    on: bus.on,
    createDataChannel(label = dataChannelLabel) {
      return peer.createDataChannel(label);
    },
    async createOffer(options) {
      state = 'negotiating';
      const offer = await peer.createOffer(options);
      await peer.setLocalDescription(offer);
      return peer.localDescription || offer;
    },
    async acceptAnswer(answer) {
      required(answer, 'answer');
      await peer.setRemoteDescription(answer);
      state = 'connected';
      bus.emit('connected');
    },
    addIceCandidate(candidate) {
      return peer.addIceCandidate(candidate);
    },
    close() {
      peer.close();
      state = 'closed';
      bus.emit('close');
    },
    get peerConnection() {
      return peer;
    },
  };
  return Object.freeze(transport);
}
