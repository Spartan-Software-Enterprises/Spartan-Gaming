import {normalizeTransportPolicy} from '../transport/policy.mjs';
import {createSettingsStore} from '../settings/profile.mjs';

export function readTransportPolicy(storage = globalThis.localStorage) {
  const settings = createSettingsStore({storage}).read();
  const preferenceMap = {'Automatic': 'auto', 'WebRTC': 'webrtc', 'WebTransport experimental': 'webtransport', 'WebSocket fallback': 'websocket'};
  const policy = normalizeTransportPolicy({preference: preferenceMap[settings['streaming.transportPreference']] || 'auto', icePolicy: settings['streaming.icePolicy'] === 'Relay only' ? 'relay' : 'all', allowWebTransport: settings['streaming.allowWebTransport'] !== false, allowWebSocketFallback: settings['streaming.allowWebSocketFallback'] !== false});
  return policy;
}

export function resolveSignalingTransport({endpoint, policy, webTransportAvailable = typeof globalThis.WebTransport === 'function', webSocketAvailable = typeof globalThis.WebSocket === 'function'} = {}) {
  const normalized = normalizeTransportPolicy(policy);
  const protocol = new URL(endpoint).protocol;
  const candidates = protocol === 'https:' ? ['webtransport'] : ['websocket'];
  if (normalized.preference !== 'auto') {
    if (!candidates.includes(normalized.preference)) throw new Error(`Preferred signaling transport requires a compatible endpoint: ${normalized.preference}`);
    if (normalized.preference === 'webtransport' && (!normalized.allowWebTransport || !webTransportAvailable)) throw new Error('WebTransport is unavailable or disabled');
    if (normalized.preference === 'websocket' && (!normalized.allowWebSocketFallback || !webSocketAvailable)) throw new Error('WebSocket fallback is unavailable or disabled');
  }
  const selected = normalized.preference === 'auto' && protocol === 'https:' && normalized.allowWebTransport && webTransportAvailable ? 'webtransport' : candidates[0];
  if (selected === 'websocket' && (!normalized.allowWebSocketFallback || !webSocketAvailable)) throw new Error('WebSocket fallback is unavailable or disabled');
  if (selected === 'webtransport' && (!normalized.allowWebTransport || !webTransportAvailable)) throw new Error('WebTransport is unavailable or disabled');
  return selected;
}
