const PUBLISHER_STATES = new Set(['unconfigured', 'planned', 'ready', 'active', 'failed']);
const TRANSPORTS = new Set(['webrtc', 'webtransport']);
const CODECS = new Set(['h264', 'vp9', 'av1']);
const DEFAULT_MAX_CHUNK_BYTES = 4 * 1024 * 1024;

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

/**
 * Forward encoded video chunks to an adapter-owned sink. The sink may be an
 * RTP/WebRTC implementation, a recorder, or a test harness; this boundary does
 * not infer that arbitrary bytes are a WebRTC track.
 */
export function createEncodedMediaPublisher({pipeline, sink, codec = 'h264', maxChunkBytes = DEFAULT_MAX_CHUNK_BYTES} = {}) {
  if (!pipeline || typeof pipeline.start !== 'function' || typeof pipeline.stop !== 'function') throw new TypeError('a native media pipeline is required');
  if (!sink || typeof sink.write !== 'function') throw new TypeError('publisher sink must implement write(chunk)');
  if (!CODECS.has(codec)) throw new TypeError(`unsupported publisher codec: ${codec}`);
  const limit = Math.max(1024, Math.min(DEFAULT_MAX_CHUNK_BYTES, Number(maxChunkBytes) || DEFAULT_MAX_CHUNK_BYTES)); let state = 'unconfigured'; let bytes = 0; let handler = null;
  const fail = error => { state = 'failed'; sink.error?.(error); void pipeline.stop().catch(() => {}); };
  const publisher = {
    get state() { return state; }, get bytesWritten() { return bytes; }, get capabilities() { return normalizePublisherCapabilities({state: state === 'active' ? 'active' : state === 'failed' ? 'failed' : 'ready', video: {codecs: [codec]}}); },
    async start() {
      if (state !== 'unconfigured' && state !== 'ready') throw new Error(`publisher cannot start from ${state}`);
      state = 'ready'; await pipeline.start(); const output = pipeline.videoOutput; if (!output?.on) { state = 'failed'; await pipeline.stop(); throw new Error('media pipeline did not expose an encoded video stream'); }
      sink.open?.({codec}); handler = chunk => { try { const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); if (value.length > limit) throw new Error('encoded media chunk exceeds publisher limit'); sink.write(Buffer.from(value)); bytes += value.length; } catch (error) { fail(error); } };
      output.on('data', handler); state = 'active'; return this;
    },
    async stop() { if (state === 'unconfigured' || state === 'stopped') return this; if (handler && pipeline.videoOutput?.off) pipeline.videoOutput.off('data', handler); handler = null; await pipeline.stop(); sink.close?.(); state = 'stopped'; return this; },
  };
  return Object.freeze(publisher);
}

/**
 * Bind encoded chunks to an RTP/WebRTC implementation supplied by the host.
 * `packetizer.push` owns codec framing and returns one or more RTP packets;
 * `transport.send` owns SRTP/WebRTC delivery. Keeping both injected lets the
 * core stay dependency-free while making the media boundary executable.
 */
export function createRtpMediaPublisher({pipeline, packetizer, transport, codec = 'h264', maxChunkBytes = DEFAULT_MAX_CHUNK_BYTES} = {}) {
  if (!packetizer || typeof packetizer.push !== 'function') throw new TypeError('packetizer must implement push(chunk, metadata)');
  if (!transport || typeof transport.send !== 'function') throw new TypeError('transport must implement send(packet)');
  let packetsSent = 0; let timestamp = 0;
  const publisher = createEncodedMediaPublisher({pipeline, codec, maxChunkBytes, sink: {
    open: metadata => { transport.open?.(metadata); },
    write: chunk => {
      const packets = packetizer.push(chunk, {codec, timestamp}); timestamp += 1;
      if (!packets || typeof packets[Symbol.iterator] !== 'function') throw new TypeError('packetizer.push must return an iterable of RTP packets');
      for (const packet of packets) { transport.send(packet); packetsSent += 1; }
    },
    close: () => { transport.close?.(); },
    error: error => { transport.error?.(error); },
  }});
  return Object.freeze({publisher, get packetsSent() { return packetsSent; }});
}
