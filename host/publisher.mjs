const PUBLISHER_STATES = new Set(['unconfigured', 'planned', 'ready', 'active', 'failed']);
const TRANSPORTS = new Set(['webrtc', 'webtransport']);
const CODECS = new Set(['h264', 'vp9', 'av1']);

function bounded(value, fallback, minimum, maximum) { const result = Number.isFinite(Number(value)) ? Number(value) : fallback; return Math.max(minimum, Math.min(maximum, result)); }
function list(value, fallback) { return Array.isArray(value) && value.length ? [...new Set(value.map(String))] : [...fallback]; }

export function normalizePublisherCapabilities(publisher = {}) {
  const state = PUBLISHER_STATES.has(publisher.state) ? publisher.state : 'unconfigured';
  const transports = list(publisher.transports, ['webrtc']).filter(item => TRANSPORTS.has(item));
  const codecs = list(publisher.video?.codecs, ['h264']).filter(item => CODECS.has(item));
  return Object.freeze({
    version: 1,
    state,
    transports: Object.freeze(transports.length ? transports : ['webrtc']),
    video: Object.freeze({codecs: Object.freeze(codecs.length ? codecs : ['h264']), maxWidth: bounded(publisher.video?.maxWidth, 1920, 1, 7680), maxHeight: bounded(publisher.video?.maxHeight, 1080, 1, 4320), maxFramerate: bounded(publisher.video?.maxFramerate, 60, 1, 240), hdr: Boolean(publisher.video?.hdr)}),
    audio: Object.freeze({codecs: Object.freeze(list(publisher.audio?.codecs, ['opus'])), channels: bounded(publisher.audio?.channels, 2, 1, 8)}),
    requires: Object.freeze(list(publisher.requires, ['native-capture-adapter', 'webrtc-publisher'])),
  });
}

export function createMediaPublisherPlan({capturePlan, encoderPlan, transport = 'webrtc', audio = false} = {}) {
  if (!capturePlan?.process?.args || capturePlan.output?.requiresPublisher !== true) throw new TypeError('capturePlan must require a media publisher');
  if (!encoderPlan?.process?.args || !CODECS.has(encoderPlan.codec)) throw new TypeError('encoderPlan is invalid');
  if (!TRANSPORTS.has(transport)) throw new TypeError(`unsupported publisher transport: ${transport}`);
  return Object.freeze({
    kind: 'media-publisher',
    state: 'plan-only',
    ready: false,
    transport,
    audio: Boolean(audio),
    capture: Object.freeze({platform: capturePlan.platform, sourceType: capturePlan.sourceType, process: capturePlan.process}),
    encoder: Object.freeze({codec: encoderPlan.codec, width: encoderPlan.width, height: encoderPlan.height, framerate: encoderPlan.framerate, bitrateKbps: encoderPlan.bitrateKbps, process: encoderPlan.process}),
    requires: Object.freeze(['native-capture-adapter', 'webrtc-publisher']),
  });
}

export function publisherIsReady(publisher) { return normalizePublisherCapabilities(publisher).state === 'ready' || normalizePublisherCapabilities(publisher).state === 'active'; }
