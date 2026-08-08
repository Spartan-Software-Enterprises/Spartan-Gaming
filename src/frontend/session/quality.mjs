export const QUALITY_PROFILES = Object.freeze([
  Object.freeze({id: 'ultra', maxWidth: 3840, maxHeight: 2160, maxFramerate: 60, bitrateKbps: 25000}),
  Object.freeze({id: 'high', maxWidth: 2560, maxHeight: 1440, maxFramerate: 60, bitrateKbps: 16000}),
  Object.freeze({id: 'balanced', maxWidth: 1920, maxHeight: 1080, maxFramerate: 60, bitrateKbps: 10000}),
  Object.freeze({id: 'low', maxWidth: 1280, maxHeight: 720, maxFramerate: 30, bitrateKbps: 6000}),
  Object.freeze({id: 'emergency', maxWidth: 960, maxHeight: 540, maxFramerate: 30, bitrateKbps: 3000}),
]);

function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
function profileIndex(id) { return Math.max(0, QUALITY_PROFILES.findIndex(profile => profile.id === id)); }

export function normalizeHealthTelemetry(sample = {}) {
  const normalized = {
    rttMs: clamp(Number(sample.rttMs) || 0, 0, 5000), jitterMs: clamp(Number(sample.jitterMs) || 0, 0, 1000),
    packetLossPct: clamp(Number(sample.packetLossPct) || 0, 0, 100), decodeMs: clamp(Number(sample.decodeMs) || 0, 0, 1000),
    bandwidthKbps: clamp(Number(sample.bandwidthKbps) || 0, 0, 1000000), frameDrops: Math.max(0, Math.floor(Number(sample.frameDrops) || 0)),
    timestamp: sample.timestamp || new Date().toISOString(),
  };
  if (typeof normalized.timestamp !== 'string') throw new TypeError('telemetry timestamp must be a string');
  return Object.freeze(normalized);
}

export function classifyNetworkHealth(sample) {
  const health = normalizeHealthTelemetry(sample);
  if (health.packetLossPct >= 5 || health.rttMs >= 220 || health.jitterMs >= 45 || health.decodeMs >= 55) return 'poor';
  if (health.packetLossPct >= 2 || health.rttMs >= 120 || health.jitterMs >= 25 || health.decodeMs >= 35) return 'fair';
  return 'good';
}

export function createQualityController({initialProfile = 'balanced', profiles = QUALITY_PROFILES, upgradeAfter = 3} = {}) {
  const available = Object.freeze([...profiles]);
  let current = profileIndex(initialProfile) < available.length ? initialProfile : available[Math.floor(available.length / 2)].id;
  let goodSamples = 0;
  return {
    get profile() { return available.find(profile => profile.id === current) || available[0]; },
    ingest(sample) {
      const health = normalizeHealthTelemetry(sample); const classification = classifyNetworkHealth(health); const before = current; const index = available.findIndex(profile => profile.id === current);
      if (classification === 'poor' && index < available.length - 1) { current = available[index + 1].id; goodSamples = 0; }
      else if (classification === 'fair') { goodSamples = 0; }
      else { goodSamples += 1; if (goodSamples >= upgradeAfter && index > 0) { current = available[index - 1].id; goodSamples = 0; } }
      const changed = before !== current;
      return Object.freeze({classification, changed, previousProfile: before, profile: this.profile, health, reason: changed ? (profileIndex(current) > profileIndex(before) ? 'network-degraded' : 'network-recovered') : 'hold'});
    },
    setProfile(id) { if (!available.some(profile => profile.id === id)) throw new Error(`unknown quality profile: ${id}`); const previousProfile = current; current = id; goodSamples = 0; return Object.freeze({changed: previousProfile !== current, previousProfile, profile: this.profile, reason: 'manual'}); },
    request() { const profile = this.profile; return Object.freeze({type: 'quality.request', profile: profile.id, maxWidth: profile.maxWidth, maxHeight: profile.maxHeight, maxFramerate: profile.maxFramerate, bitrateKbps: profile.bitrateKbps}); },
  };
}
