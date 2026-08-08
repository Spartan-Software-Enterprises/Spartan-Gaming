import {createNativeWeriftHostFromPlatformBindings} from './native-host.mjs';

function eventBus() {
  const listeners = new Map();
  return {
    on(type, handler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); return () => listeners.get(type)?.delete(handler); },
    emit(type, value) { for (const handler of listeners.get(type) || []) void Promise.resolve(handler(value)).catch(error => { for (const observer of listeners.get('error') || []) observer(error); }); },
  };
}

/** Adapt one authenticated WebSocket connection to the Werift signaling contract. */
export function createNativeSignalingBridge({connection} = {}) {
  if (!connection || typeof connection.send !== 'function') throw new TypeError('a connection with send(message) is required');
  const bus = eventBus(); let closed = false;
  return Object.freeze({
    on: bus.on,
    emit(type, value) { if (!closed) bus.emit(type, value); },
    async connect() { if (closed) throw new Error('native signaling bridge is closed'); },
    send(message) { if (closed) throw new Error('native signaling bridge is closed'); connection.send(message); },
    close() { if (closed) return; closed = true; connection.close?.(); bus.emit('close'); },
  });
}

/**
 * Create the executable native host for one already-authenticated session.
 * Pairing, launch-request validation, and session admission remain owned by
 * the caller; this object owns media, audio, input, and native lifecycle.
 */
export function createNativeWeriftConnection({connection, sessionId, bindings, module, platform, permissions = {}, includeAudio = false, runtimeProfile = null, gamePath = null, gameArgs = [], gameCwd, gameEnv, hostContentId = null, ...options} = {}) {
  if (typeof sessionId !== 'string' || !sessionId.trim()) throw new TypeError('sessionId is required');
  const signaling = createNativeSignalingBridge({connection});
  const host = createNativeWeriftHostFromPlatformBindings({bindings, platform, permissions, includeAudio, runtimeProfile, gamePath, gameArgs, gameCwd, gameEnv, hostContentId, signaling, module, sessionId, ...options});
  return Object.freeze({
    host,
    signaling,
    start: host.start,
    receive(message) { signaling.emit('message', message); },
    close() { host.close(); },
  });
}
