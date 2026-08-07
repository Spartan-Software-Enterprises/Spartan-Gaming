const VALID_STATES = new Set(['idle', 'preparing', 'negotiating', 'connected', 'reconnecting', 'ended', 'error']);

export function createPlayerState(overrides = {}) {
  const state = {status: 'idle', quality: 'balanced', mediaState: 'waiting', latencyMs: null, packetLossPct: 0, overlayVisible: true, diagnosticsVisible: false, gamepadConnected: false, error: null, ...overrides};
  if (!VALID_STATES.has(state.status)) throw new TypeError(`unsupported player status: ${state.status}`);
  return Object.freeze(state);
}

export function reducePlayerState(state, event) {
  const current = createPlayerState(state);
  if (!event?.type) throw new TypeError('player event type is required');
  const next = {...current};
  if (event.type === 'session.state') next.status = event.status;
  if (event.type === 'quality.changed') next.quality = event.profile;
  if (event.type === 'media.state') next.mediaState = String(event.state || 'waiting');
  if (event.type === 'telemetry.health') { next.latencyMs = Number.isFinite(event.rttMs) ? Math.round(event.rttMs) : next.latencyMs; next.packetLossPct = Number.isFinite(event.packetLossPct) ? event.packetLossPct : next.packetLossPct; }
  if (event.type === 'toggle.overlay') next.overlayVisible = !current.overlayVisible;
  if (event.type === 'toggle.diagnostics') next.diagnosticsVisible = !current.diagnosticsVisible;
  if (event.type === 'gamepad.connection') next.gamepadConnected = Boolean(event.connected);
  if (event.type === 'error') { next.status = 'error'; next.error = String(event.message || 'Session error'); }
  return createPlayerState(next);
}

export function formatLatency(latencyMs) { return Number.isFinite(latencyMs) ? `${Math.round(latencyMs)} ms` : '—'; }
