const ACTIONS = Object.freeze({policy: 'android.policy', gameMode: 'android.game-mode.query', controllers: 'android.controllers.snapshot', textInput: 'android.text-input', gameNative: 'android.gamenative.launch'});
const MAX_MESSAGE_BYTES = 16 * 1024;
const GAME_NATIVE_STORES = new Set(['STEAM', 'EPIC', 'GOG', 'AMAZON']);

function boundedText(value, fallback = '') {
  return typeof value === 'string' && value.length <= 512 && !/[\u0000\r\n]/.test(value) ? value : fallback;
}

function messageSize(value) {
  try { return new TextEncoder().encode(value).length; } catch { return value.length; }
}

function encode(action, payload = {}) {
  if (!Object.values(ACTIONS).includes(action)) throw new TypeError('unsupported Android bridge action');
  const message = JSON.stringify({version: 1, action, payload});
  if (messageSize(message) > MAX_MESSAGE_BYTES) throw new RangeError('Android bridge message exceeds the size limit');
  return message;
}

/**
 * Adapt the shared frontend to an optional Android WebView JavaScript bridge.
 * The native side receives one versioned, bounded JSON message and remains
 * responsible for permissions, lifecycle, and device API calls.
 */
export function createAndroidBridge({bridge = globalThis.SpartanAndroid} = {}) {
  const postMessage = typeof bridge?.postMessage === 'function' ? bridge.postMessage.bind(bridge) : null;
  const send = (action, payload = {}) => {
    if (!postMessage) return Object.freeze({status: 'unavailable', action});
    try {
      const message = encode(action, payload);
      const result = postMessage(message);
      return Object.freeze({status: 'requested', action, ...(typeof result === 'boolean' ? {accepted: result} : {})});
    } catch (error) {
      return Object.freeze({status: 'rejected', action, reason: boundedText(error?.message, 'bridge rejected message')});
    }
  };
  return Object.freeze({
    available: postMessage !== null,
    send,
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

export {ACTIONS, GAME_NATIVE_STORES, MAX_MESSAGE_BYTES};
