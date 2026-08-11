const SAMPLE_FIELDS = Object.freeze([
  'timestamp',
  'rttMs',
  'packetLossPct',
  'decodeFps',
  'framesDropped',
  'jitterMs',
  'bitrateKbps',
]);

function number(value, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const result = Number(value);
  return Number.isFinite(result) ? Math.max(minimum, Math.min(maximum, result)) : null;
}

export function normalizeTelemetrySample(
  sample = {},
  { timestamp = new Date().toISOString() } = {},
) {
  const normalized = {
    timestamp:
      typeof sample.timestamp === 'number' || typeof sample.timestamp === 'string'
        ? sample.timestamp
        : timestamp,
  };
  for (const field of SAMPLE_FIELDS.slice(1))
    normalized[field] = number(
      sample[field],
      0,
      field === 'packetLossPct'
        ? 100
        : field === 'decodeFps'
          ? 240
          : field === 'rttMs' || field === 'jitterMs'
            ? 60000
            : Number.MAX_SAFE_INTEGER,
    );
  return Object.freeze(normalized);
}

export function createSessionTelemetryLog({
  enabled = true,
  maxSamples = 300,
  clock = () => new Date().toISOString(),
} = {}) {
  const limit = Math.max(1, Math.min(1000, Math.floor(Number(maxSamples) || 300)));
  let active = Boolean(enabled);
  const samples = [];
  return Object.freeze({
    get enabled() {
      return active;
    },
    setEnabled(value) {
      active = Boolean(value);
      if (!active) samples.length = 0;
      return active;
    },
    add(sample) {
      if (!active) return null;
      const normalized = normalizeTelemetrySample(sample, { timestamp: clock() });
      samples.push(normalized);
      while (samples.length > limit) samples.shift();
      return normalized;
    },
    list() {
      return Object.freeze([...samples]);
    },
    clear() {
      samples.length = 0;
    },
  });
}

export function createSessionDiagnosticsBundle({
  session = {},
  negotiated = null,
  samples = [],
  adjustments = [],
  collectedAt = new Date().toISOString(),
} = {}) {
  return Object.freeze({
    version: 1,
    product: 'Spartan Gaming',
    collectedAt,
    session: Object.freeze({
      backendId: typeof session.backendId === 'string' ? session.backendId : null,
      backendType: typeof session.backendType === 'string' ? session.backendType : null,
      quality: typeof session.quality === 'string' ? session.quality : null,
    }),
    negotiated: negotiated
      ? Object.freeze({
          transports: Array.isArray(negotiated.transports) ? [...negotiated.transports] : [],
          video: Object.freeze({ ...negotiated.video }),
          audio: Object.freeze({ ...negotiated.audio }),
        })
      : null,
    adjustments: Object.freeze(
      Array.isArray(adjustments)
        ? adjustments.filter((item) => typeof item === 'string').slice(0, 32)
        : [],
    ),
    samples: Object.freeze(samples.slice(-300).map((sample) => normalizeTelemetrySample(sample))),
  });
}

export function serializeSessionDiagnostics(bundle) {
  return JSON.stringify(bundle, null, 2);
}
