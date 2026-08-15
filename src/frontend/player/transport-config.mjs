import { normalizeTransportPolicy } from '../transport/policy.mjs';
import { createSettingsStore } from '../settings/profile.mjs';

export function readTransportPolicy(storage = globalThis.localStorage) {
  const settings = createSettingsStore({ storage }).read();
  const preferenceMap = {
    Automatic: 'auto',
    WebRTC: 'webrtc',
    'WebTransport experimental': 'webtransport',
    'WebSocket fallback': 'websocket',
  };
  const privacyRelay = settings['privacy.preventWebRtcIpLeak'] === true;
  const policy = normalizeTransportPolicy({
    preference: preferenceMap[settings['streaming.transportPreference']] || 'auto',
    icePolicy: privacyRelay || settings['streaming.icePolicy'] === 'Relay only' ? 'relay' : 'all',
    allowWebTransport:
      settings['streaming.allowWebTransport'] !== false &&
      settings['advanced.experimentalWebTransport'] === true,
    allowWebSocketFallback: settings['streaming.allowWebSocketFallback'] !== false,
  });
  return policy;
}

export function resolveSignalingEndpoint({
  queryEndpoint = '',
  pendingEndpoint = '',
  recoveryEndpoint = '',
  customEndpoint = '',
} = {}) {
  return (
    [queryEndpoint, pendingEndpoint, recoveryEndpoint, customEndpoint]
      .find((value) => typeof value === 'string' && value.trim())
      ?.trim() || ''
  );
}

export function resolveSignalingTransport({
  endpoint,
  policy,
  webTransportAvailable = typeof globalThis.WebTransport === 'function',
  webSocketAvailable = typeof globalThis.WebSocket === 'function',
} = {}) {
  const normalized = normalizeTransportPolicy(policy);
  let parsed;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new TypeError('signaling endpoint is invalid');
  }
  const loopback =
    parsed.hostname === 'localhost' ||
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname === '[::1]';
  if (
    parsed.username ||
    parsed.password ||
    (!['https:', 'wss:'].includes(parsed.protocol) && !(parsed.protocol === 'ws:' && loopback))
  )
    throw new TypeError('signaling endpoint must use a secure URL or loopback WebSocket');
  const protocol = parsed.protocol;
  const candidates = protocol === 'https:' ? ['webtransport'] : ['websocket'];
  const signalingPreference = normalized.preference === 'webrtc' ? 'auto' : normalized.preference;
  if (signalingPreference !== 'auto') {
    if (!candidates.includes(signalingPreference))
      throw new Error(
        `Preferred signaling transport requires a compatible endpoint: ${signalingPreference}`,
      );
    if (
      signalingPreference === 'webtransport' &&
      (!normalized.allowWebTransport || !webTransportAvailable)
    )
      throw new Error('WebTransport is unavailable or disabled');
    if (
      signalingPreference === 'websocket' &&
      (!normalized.allowWebSocketFallback || !webSocketAvailable)
    )
      throw new Error('WebSocket fallback is unavailable or disabled');
  }
  const selected =
    signalingPreference === 'auto' &&
    protocol === 'https:' &&
    normalized.allowWebTransport &&
    webTransportAvailable
      ? 'webtransport'
      : candidates[0];
  if (selected === 'websocket' && (!normalized.allowWebSocketFallback || !webSocketAvailable))
    throw new Error('WebSocket fallback is unavailable or disabled');
  if (selected === 'webtransport' && (!normalized.allowWebTransport || !webTransportAvailable))
    throw new Error('WebTransport is unavailable or disabled');
  return selected;
}
