const ACTIONS = Object.freeze({policy: 'android.policy', gameMode: 'android.game-mode.query', controllers: 'android.controllers.snapshot', textInput: 'android.text-input', gameNative: 'android.gamenative.launch'});
const MAX_MESSAGE_BYTES = 16 * 1024;
const MAX_REQUEST_ID_LENGTH = 64;
const RESULT_STATUSES = new Set(['accepted', 'rejected']);
const RESULT_EVENT = 'spartan:android-result';
const GAME_NATIVE_STORES = new Set(['STEAM', 'EPIC', 'GOG', 'AMAZON']);

function boundedText(value, fallback = '') {
  return typeof value === 'string' && value.length <= 512 && !/[\u0000\r\n]/.test(value) ? value : fallback;
}

function messageSize(value) {
  try { return new TextEncoder().encode(value).length; } catch { return value.length; }
}

function validRequestId(value) { return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value); }

function encode(requestId, action, payload = {}) {
  if (!Object.values(ACTIONS).includes(action)) throw new TypeError('unsupported Android bridge action');
  if (!validRequestId(requestId)) throw new TypeError('Android bridge request ID is invalid');
  const message = JSON.stringify({version: 1, requestId, action, payload});
  if (messageSize(message) > MAX_MESSAGE_BYTES) throw new RangeError('Android bridge message exceeds the size limit');
  return message;
}

export function normalizeAndroidResult(value) {
  if (!value || value.version !== 1 || !validRequestId(value.requestId) || !Object.values(ACTIONS).includes(value.action) || !RESULT_STATUSES.has(value.status)) return null;
  return Object.freeze({version: 1, requestId: value.requestId, action: value.action, status: value.status, ...(value.payload && typeof value.payload === 'object' ? {payload: Object.freeze({...value.payload})} : {})});
}

/**
 * Adapt the shared frontend to an optional Android WebView JavaScript bridge.
 * The native side receives one versioned, bounded JSON message and remains
 * responsible for permissions, lifecycle, and device API calls.
 */
export function createAndroidBridge({bridge = globalThis.SpartanAndroid, target = globalThis, idFactory} = {}) {
  const postMessage = typeof bridge?.postMessage === 'function' ? bridge.postMessage.bind(bridge) : null;
  let sequence = 0;
  const nextRequestId = () => {
    const candidate = typeof idFactory === 'function' ? idFactory() : `and-${Date.now().toString(36)}-${(++sequence).toString(36)}`;
    return validRequestId(candidate) ? candidate : `and-${(++sequence).toString(36)}`;
  };
  const send = (action, payload = {}) => {
    const requestId = nextRequestId();
    if (!postMessage) return Object.freeze({status: 'unavailable', action, requestId});
    try {
      const message = encode(requestId, action, payload);
      const result = postMessage(message);
      return Object.freeze({status: 'requested', action, requestId, ...(typeof result === 'boolean' ? {accepted: result} : {})});
    } catch (error) {
      return Object.freeze({status: 'rejected', action, requestId, reason: boundedText(error?.message, 'bridge rejected message')});
    }
  };
  const listen = onResult => {
    if (typeof onResult !== 'function' || typeof target?.addEventListener !== 'function') return () => {};
    const listener = event => { const result = normalizeAndroidResult(event?.detail); if (result) onResult(result); };
    target.addEventListener(RESULT_EVENT, listener);
    return () => target.removeEventListener?.(RESULT_EVENT, listener);
  };
  return Object.freeze({
    available: postMessage !== null,
    send,
    listen,
    applyPolicy(policy) { return send(ACTIONS.policy, policy); },
    queryGameMode() { return send(ACTIONS.gameMode); },
    requestControllerInventory() { return send(ACTIONS.controllers); },
    requestTextInput(request) { return send(ACTIONS.textInput, request); },
    launchGameNative({appId, store} = {}) {
      const numericId = Number(appId);
      const normalizedStore = typeof store === 'string' ? store.trim().toUpperCase() : '';
      if (!Number.isSafeInteger(numericId) || numericId <= 0 || !GAME_NATIVE_STORES.has(normalizedStore)) return Object.freeze({status: 'rejected', action: ACTIONS.gameNative, reason: 'GameNative requires a positive library app ID and supported store'});
      return send(ACTIONS.gameNative, {appId: numericId, store: normalizedStore});
    },
  });
}

export {ACTIONS, GAME_NATIVE_STORES, MAX_MESSAGE_BYTES, MAX_REQUEST_ID_LENGTH, RESULT_EVENT};
