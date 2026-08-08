function eventBus() { const listeners = new Map(); return {on(type, handler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); return () => listeners.get(type)?.delete(handler); }, emit(type, value) { for (const handler of listeners.get(type) || []) handler(value); }}; }
function asNumber(value, fallback = 0) { return Number.isFinite(Number(value)) ? Number(value) : fallback; }
function reportValues(report) { if (!report) return []; if (typeof report.values === 'function') return [...report.values()]; if (typeof report[Symbol.iterator] === 'function') return [...report]; return Array.isArray(report) ? report : Object.values(report); }

export function normalizeWebRtcStats(report, {previous = null, now = Date.now()} = {}) {
  const entries = reportValues(report); const inbound = entries.filter(item => item?.type === 'inbound-rtp');
  const video = inbound.find(item => item.kind === 'video' || item.mediaType === 'video') || inbound[0] || {};
  const candidate = entries.find(item => item?.type === 'candidate-pair' && (item.state === 'succeeded' || item.nominated)) || entries.find(item => item?.type === 'candidate-pair') || {};
  const lost = asNumber(video.packetsLost); const received = asNumber(video.packetsReceived); const priorLost = asNumber(previous?.packetsLost, lost); const priorReceived = asNumber(previous?.packetsReceived, received); const deltaTotal = Math.max(0, (lost - priorLost) + (received - priorReceived));
  const packetLossPct = deltaTotal ? Math.round(((lost - priorLost) / deltaTotal) * 1000) / 10 : Math.round((lost / Math.max(1, lost + received)) * 1000) / 10;
  const timestamp = asNumber(now); const elapsedMs = Math.max(1, timestamp - asNumber(previous?.timestamp, timestamp)); const frames = asNumber(video.framesDecoded); const priorFrames = asNumber(previous?.framesDecoded, frames);
  const bytesReceived = asNumber(video.bytesReceived); const priorBytes = asNumber(previous?.bytesReceived, bytesReceived);
  return Object.freeze({timestamp, rttMs: Math.round(asNumber(candidate.currentRoundTripTime || candidate.roundTripTime) * 1000), packetLossPct: Math.max(0, Math.min(100, packetLossPct)), decodeFps: Math.round(Math.max(0, frames - priorFrames) * 1000 / elapsedMs), framesDropped: asNumber(video.framesDropped), jitterMs: Math.round(asNumber(video.jitter) * 1000), bitrateKbps: Math.round(Math.max(0, bytesReceived - priorBytes) * 8 / elapsedMs), bytesReceived, packetsLost: lost, packetsReceived: received});
}

export function createWebRtcTelemetryCollector({peerConnection, intervalMs = 1000, scheduler = setInterval, clearScheduler = clearInterval, clock = () => Date.now()} = {}) {
  if (!peerConnection || typeof peerConnection.getStats !== 'function') throw new TypeError('peerConnection.getStats is required');
  const bus = eventBus(); let timer = null; let previous = null; let polling = false;
  const poll = async () => { if (polling) return; polling = true; try { const sample = normalizeWebRtcStats(await peerConnection.getStats(), {previous, now: clock()}); previous = sample; bus.emit('health', sample); } catch (error) { bus.emit('error', error); } finally { polling = false; } };
  return Object.freeze({on: bus.on, get running() { return timer !== null; }, start() { if (timer === null) { timer = scheduler(poll, intervalMs); poll(); } return this; }, stop() { if (timer !== null) clearScheduler(timer); timer = null; previous = null; return this; }, poll});
}
