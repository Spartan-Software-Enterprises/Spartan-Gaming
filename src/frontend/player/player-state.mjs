const VALID_STATES = new Set([
  'idle',
  'preparing',
  'negotiating',
  'connected',
  'reconnecting',
  'ended',
  'error',
]);

export function createPlayerState(overrides = {}) {
  const state = {
    status: 'idle',
    quality: 'balanced',
    mediaState: 'waiting',
    latencyMs: null,
    packetLossPct: 0,
    decodeFps: null,
    framesDropped: 0,
    jitterMs: null,
    bitrateKbps: null,
    overlayVisible: true,
    diagnosticsVisible: false,
    gamepadConnected: false,
    negotiated: null,
    error: null,
    ...overrides,
  };
  if (!VALID_STATES.has(state.status))
    throw new TypeError(`unsupported player status: ${state.status}`);
  return Object.freeze(state);
}

export function reducePlayerState(state, event) {
  const current = createPlayerState(state);
  if (!event?.type) throw new TypeError('player event type is required');
  const next = { ...current };
  if (event.type === 'session.state') next.status = event.status;
  if (event.type === 'quality.changed') next.quality = event.profile;
  if (event.type === 'media.state') next.mediaState = String(event.state || 'waiting');
  if (event.type === 'telemetry.health') {
    next.latencyMs = Number.isFinite(event.rttMs) ? Math.round(event.rttMs) : next.latencyMs;
    next.packetLossPct = Number.isFinite(event.packetLossPct)
      ? event.packetLossPct
      : next.packetLossPct;
    next.decodeFps = Number.isFinite(event.decodeFps)
      ? Math.max(0, Math.round(event.decodeFps))
      : next.decodeFps;
    next.framesDropped = Number.isFinite(event.framesDropped)
      ? Math.max(0, Math.round(event.framesDropped))
      : next.framesDropped;
    next.jitterMs = Number.isFinite(event.jitterMs)
      ? Math.max(0, Math.round(event.jitterMs))
      : next.jitterMs;
    next.bitrateKbps = Number.isFinite(event.bitrateKbps)
      ? Math.max(0, Math.round(event.bitrateKbps))
      : next.bitrateKbps;
  }
  if (event.type === 'toggle.overlay') next.overlayVisible = !current.overlayVisible;
  if (event.type === 'toggle.diagnostics') next.diagnosticsVisible = !current.diagnosticsVisible;
  if (event.type === 'gamepad.connection') next.gamepadConnected = Boolean(event.connected);
  if (event.type === 'session.negotiated') next.negotiated = event.capabilities || null;
  if (event.type === 'error') {
    next.status = 'error';
    next.error = String(event.message || 'Session error');
  }
  return createPlayerState(next);
}

export function formatLatency(latencyMs) {
  return Number.isFinite(latencyMs) ? `${Math.round(latencyMs)} ms` : '—';
}
export function formatRate(kbps) {
  return Number.isFinite(kbps)
    ? kbps >= 1000
      ? `${(kbps / 1000).toFixed(1)} Mbps`
      : `${Math.round(kbps)} Kbps`
    : '—';
}

export function formatNegotiatedCapabilities(capabilities) {
  if (!capabilities) return 'Pending';
  const transport = capabilities.transports?.[0] || 'unknown';
  const video = capabilities.video?.codec || 'unknown';
  const audio = capabilities.audio?.codec || 'unknown';
  const resolution =
    capabilities.video?.maxWidth && capabilities.video?.maxHeight
      ? `${capabilities.video.maxWidth}×${capabilities.video.maxHeight}`
      : 'unknown size';
  return `${transport} · ${video} · ${audio} · ${resolution}`;
}
