const CLOUD_STREAM_PRESETS = Object.freeze({
  'ultra-low-latency-720p60': Object.freeze({
    id: 'ultra-low-latency-720p60',
    name: '720p 60fps (Ultra-Low Latency)',
    width: 1280,
    height: 720,
    framerate: 60,
    bitrateKbps: 5000,
    dataUsageGbPerHour: 2.25,
    description: 'Prioritizes minimum packet delay and fast response times for competitive titles.',
  }),
  'balanced-1080p60': Object.freeze({
    id: 'balanced-1080p60',
    name: '1080p 60fps (Balanced)',
    width: 1920,
    height: 1080,
    framerate: 60,
    bitrateKbps: 12000,
    dataUsageGbPerHour: 5.4,
    description: 'Optimal balance of image fidelity and streaming stability for standard displays.',
  }),
  'high-quality-1440p60': Object.freeze({
    id: 'high-quality-1440p60',
    name: '1440p 60fps (High Quality)',
    width: 2560,
    height: 1440,
    framerate: 60,
    bitrateKbps: 25000,
    dataUsageGbPerHour: 11.25,
    description: 'High-resolution streaming for 1440p monitors and fast broadband connections.',
  }),
  'ultra-4k60': Object.freeze({
    id: 'ultra-4k60',
    name: '4K 60fps (Ultra HD)',
    width: 3840,
    height: 2160,
    framerate: 60,
    bitrateKbps: 45000,
    dataUsageGbPerHour: 20.25,
    description: 'Maximum visual fidelity for 4K displays and high-speed fiber internet.',
  }),
  'mobile-saver-720p30': Object.freeze({
    id: 'mobile-saver-720p30',
    name: '720p 30fps (Data Saver)',
    width: 1280,
    height: 720,
    framerate: 30,
    bitrateKbps: 3000,
    dataUsageGbPerHour: 1.35,
    description: 'Reduced bitrate and frame rate for metered cellular or handheld connections.',
  }),
});

const CLOUD_PROVIDER_REGIONS = Object.freeze({
  'xbox-cloud-gaming': Object.freeze({
    'north-america': 'https://westus.cloudgaming.xbox.com/ping',
    europe: 'https://westeurope.cloudgaming.xbox.com/ping',
    'asia-pacific': 'https://japaneast.cloudgaming.xbox.com/ping',
    'latin-america': 'https://brazilsouth.cloudgaming.xbox.com/ping',
  }),
  'nvidia-geforce-now': Object.freeze({
    'north-america': 'https://us-west.geforcenow.com/ping',
    europe: 'https://eu-central.geforcenow.com/ping',
    'asia-pacific': 'https://ap-east.geforcenow.com/ping',
    'latin-america': 'https://sa-east.geforcenow.com/ping',
  }),
  'amazon-luna': Object.freeze({
    'north-america': 'https://luna-us-west-2.amazon.com/ping',
    europe: 'https://luna-eu-west-1.amazon.com/ping',
  }),
  boosteroid: Object.freeze({
    'north-america': 'https://us-east.boosteroid.com/ping',
    europe: 'https://eu-central.boosteroid.com/ping',
  }),
});

function slugify(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Retrieve normalized cloud stream preset specifications.
 */
export function getCloudStreamPreset(presetId = 'balanced-1080p60') {
  return CLOUD_STREAM_PRESETS[presetId] || CLOUD_STREAM_PRESETS['balanced-1080p60'];
}

/**
 * List all available cloud stream presets.
 */
export function listCloudStreamPresets() {
  return Object.freeze(Object.values(CLOUD_STREAM_PRESETS));
}

/**
 * Calculate expected bandwidth and data transfer for a cloud gaming session duration.
 */
export function calculateBandwidthUsage({ bitrateKbps = 12000, durationMinutes = 60 } = {}) {
  const boundedBitrate = Math.max(
    250,
    Math.min(100000, Number.isFinite(Number(bitrateKbps)) ? Number(bitrateKbps) : 12000),
  );
  const boundedDuration = Math.max(
    1,
    Math.min(1440, Number.isFinite(Number(durationMinutes)) ? Number(durationMinutes) : 60),
  );

  const totalBits = boundedBitrate * 1000 * boundedDuration * 60;
  const totalBytes = totalBits / 8;
  const totalMb = Number((totalBytes / (1024 * 1024)).toFixed(2));
  const totalGb = Number((totalBytes / (1024 * 1024 * 1024)).toFixed(2));

  return Object.freeze({
    bitrateKbps: boundedBitrate,
    durationMinutes: boundedDuration,
    totalMb,
    totalGb,
  });
}

/**
 * Build deep-link launch URLs for official cloud gaming service games.
 */
export function createCloudGameDeepLink(providerId, gameIdentifier) {
  if (typeof providerId !== 'string' || typeof gameIdentifier !== 'string') return null;
  const id = gameIdentifier.trim();
  const slug = slugify(id);
  if (!id || !slug) return null;

  switch (providerId) {
    case 'xbox-cloud-gaming':
      return `https://www.xbox.com/play/games/${encodeURIComponent(slug)}`;
    case 'nvidia-geforce-now':
      return `https://play.geforcenow.com/mall/#/deep-link?game-id=${encodeURIComponent(id)}`;
    case 'amazon-luna':
      return `https://luna.amazon.com/game/${encodeURIComponent(slug)}`;
    case 'boosteroid':
      return `https://boosteroid.com/desktop?game=${encodeURIComponent(slug)}`;
    case 'blacknut':
      return `https://www.blacknut.com/game/${encodeURIComponent(slug)}`;
    case 'antstream':
      return `https://www.antstream.com/game/${encodeURIComponent(slug)}`;
    default:
      return null;
  }
}

/**
 * Probe network latency (RTT in ms) to a cloud gaming regional endpoint.
 */
export function probeProviderRegionLatency({
  endpointUrl,
  timeoutMs = 3000,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!endpointUrl || typeof fetchImpl !== 'function') {
    return Promise.resolve(
      Object.freeze({ success: false, latencyMs: null, reason: 'Invalid parameters' }),
    );
  }

  const start = globalThis.performance?.now?.() ?? Date.now();
  const controller =
    typeof globalThis.AbortController === 'function' ? new globalThis.AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  return fetchImpl(endpointUrl, {
    method: 'HEAD',
    mode: 'no-cors',
    signal: controller?.signal,
  })
    .then(() => {
      if (timer) clearTimeout(timer);
      const elapsed = (globalThis.performance?.now?.() ?? Date.now()) - start;
      return Object.freeze({
        success: true,
        latencyMs: Math.round(elapsed),
        endpointUrl,
      });
    })
    .catch((error) => {
      if (timer) clearTimeout(timer);
      return Object.freeze({
        success: false,
        latencyMs: null,
        endpointUrl,
        reason: error?.name === 'AbortError' ? 'timed out' : error?.message || 'probe failed',
      });
    });
}

/**
 * Select the optimal cloud region from a set of regional latency probe results.
 */
export function selectOptimalCloudRegion(regionLatencies = {}) {
  let bestRegion = 'automatic';
  let minLatency = Infinity;

  for (const [region, result] of Object.entries(regionLatencies)) {
    if (result && typeof result.latencyMs === 'number' && result.latencyMs < minLatency) {
      minLatency = result.latencyMs;
      bestRegion = region;
    }
  }

  return Object.freeze({
    optimalRegion: bestRegion,
    lowestLatencyMs: Number.isFinite(minLatency) ? minLatency : null,
  });
}
