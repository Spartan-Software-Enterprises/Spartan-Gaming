import { parseHostEndpoint } from '../src/frontend/host/host.mjs';

function required(value, name) {
  if (typeof value !== 'string' || !value.trim())
    throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}

export function createHostSignalingClient({
  endpoint,
  sessionId,
  ticket,
  WebSocketImpl = globalThis.WebSocket,
  onMessage = () => {},
  onError = () => {},
  onClose = () => {},
} = {}) {
  const parsed = parseHostEndpoint(endpoint, { allowInsecureLocalhost: true });
  if (!['ws:', 'wss:'].includes(parsed.protocol))
    throw new TypeError('host signaling endpoint must use ws or wss');
  const id = required(sessionId, 'sessionId');
  const joinTicket = required(ticket, 'ticket');
  if (
    typeof onMessage !== 'function' ||
    typeof onError !== 'function' ||
    typeof onClose !== 'function'
  )
    throw new TypeError('signaling callbacks must be functions');
  let socket = null;
  let state = 'idle';
  let connectReject;
  const client = {
    get state() {
      return state;
    },
    connect() {
      if (state === 'open') return Promise.resolve();
      if (typeof WebSocketImpl !== 'function')
        return Promise.reject(new Error('WebSocket is unavailable in this host runtime'));
      state = 'connecting';
      return new Promise((resolve, reject) => {
        connectReject = reject;
        socket = new WebSocketImpl(parsed.url);
        socket.onopen = () => {
          try {
            socket.send(
              JSON.stringify({
                type: 'signaling.join',
                sessionId: id,
                role: 'host',
                ticket: joinTicket,
              }),
            );
            state = 'open';
            connectReject = undefined;
            resolve();
          } catch (error) {
            state = 'error';
            connectReject = undefined;
            reject(error);
            onError(error);
          }
        };
        socket.onmessage = (event) => {
          try {
            onMessage(JSON.parse(typeof event.data === 'string' ? event.data : String(event.data)));
          } catch (error) {
            onError(error);
          }
        };
        socket.onerror = (error) => {
          state = 'error';
          const failure =
            error instanceof Error ? error : new Error('host signaling connection failed');
          onError(failure);
          if (connectReject) {
            connectReject(failure);
            connectReject = undefined;
          }
        };
        socket.onclose = (event) => {
          state = 'closed';
          onClose(event);
        };
      });
    },
    send(message) {
      if (state !== 'open' || !socket) throw new Error('host signaling connection is not open');
      socket.send(JSON.stringify(message));
    },
    close() {
      if (state === 'closed') return;
      state = 'closed';
      socket?.close?.();
    },
  };
  return Object.freeze(client);
}
