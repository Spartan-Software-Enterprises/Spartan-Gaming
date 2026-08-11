import { createIceConfiguration } from './ice.mjs';

const PREFERENCES = new Set(['auto', 'webrtc', 'webtransport', 'websocket']);
const POLICIES = new Set(['all', 'relay']);
const ORDER = Object.freeze(['webrtc', 'webtransport', 'websocket']);

export function normalizeTransportPolicy(policy = {}) {
  const preference = PREFERENCES.has(policy.preference) ? policy.preference : 'auto';
  const icePolicy = POLICIES.has(policy.icePolicy) ? policy.icePolicy : 'all';
  return Object.freeze({
    preference,
    icePolicy,
    allowWebTransport: policy.allowWebTransport !== false,
    allowWebSocketFallback: policy.allowWebSocketFallback !== false,
    credentials: 'session-scoped',
  });
}

export function selectSessionTransport({
  clientTransports = ORDER,
  remoteTransports = ORDER,
  policy = {},
} = {}) {
  const normalized = normalizeTransportPolicy(policy);
  const available = ORDER.filter(
    (transport) =>
      clientTransports.includes(transport) &&
      remoteTransports.includes(transport) &&
      (transport !== 'webtransport' || normalized.allowWebTransport) &&
      (transport !== 'websocket' || normalized.allowWebSocketFallback),
  );
  if (!available.length) throw new Error('No permitted compatible session transport');
  if (normalized.preference !== 'auto') {
    if (available.includes(normalized.preference)) return normalized.preference;
    throw new Error(`Preferred transport is unavailable: ${normalized.preference}`);
  }
  return available[0];
}

export function createSessionTransportOptions({ policy = {}, ice } = {}) {
  const normalized = normalizeTransportPolicy(policy);
  return Object.freeze({
    policy: normalized,
    ice: ice ? createIceConfiguration({ ...ice, policy: normalized.icePolicy }) : undefined,
  });
}
