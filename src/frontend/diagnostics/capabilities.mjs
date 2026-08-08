const CODEC_PROBES = Object.freeze({
  h264: 'video/mp4; codecs="avc1.4d401f"', vp9: 'video/webm; codecs="vp09.00.10.08"', av1: 'video/mp4; codecs="av01.0.08M.08"', opus: 'audio/webm; codecs="opus"',
});
const HARDWARE_DECODE_PROBES = Object.freeze({h264: CODEC_PROBES.h264, vp9: CODEC_PROBES.vp9, av1: CODEC_PROBES.av1});

function supported(probe, value) { try { return Boolean(probe?.isTypeSupported?.(value)); } catch { return false; } }
function bool(value) { return value === true; }

function finite(value, fallback = null) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
function displayRecord(screen, index) { return Object.freeze({index, width: finite(screen?.width, 0), height: finite(screen?.height, 0), availWidth: finite(screen?.availWidth, 0), availHeight: finite(screen?.availHeight, 0), pixelRatio: finite(screen?.devicePixelRatio, 1), refreshRate: finite(screen?.refreshRate)}); }
async function probeDisplays(navigatorValue, screenLike, matchMediaLike) {
  let screens = [];
  if (typeof navigatorValue?.getScreenDetails === 'function') { try { const details = await navigatorValue.getScreenDetails(); screens = Array.isArray(details?.screens) ? details.screens : []; } catch { screens = []; } }
  if (!screens.length && screenLike) screens = [screenLike];
  const displays = screens.map((screen, index) => displayRecord(screen, index)); const refreshRates = displays.map(display => display.refreshRate).filter(value => value !== null);
  const hdr = typeof matchMediaLike === 'function' ? Boolean(matchMediaLike('(dynamic-range: high)')?.matches) : false;
  return Object.freeze({count: displays.length, extended: screens.length > 1 || screenLike?.isExtended === true, hdr, maxRefreshRate: refreshRates.length ? Math.max(...refreshRates) : null, displays: Object.freeze(displays)});
}

async function probeHardwareDecode(mediaCapabilities, codecs) {
  const names = Object.keys(HARDWARE_DECODE_PROBES);
  if (typeof mediaCapabilities?.decodingInfo !== 'function') return Object.fromEntries(names.map(name => [name, {available: false, supported: Boolean(codecs[name]), smooth: false, powerEfficient: false}]));
  const results = await Promise.all(names.map(async name => {
    try {
      const result = await mediaCapabilities.decodingInfo({type: 'media-source', video: {contentType: HARDWARE_DECODE_PROBES[name], width: 1920, height: 1080, bitrate: 8_000_000, framerate: 60, hardwareAcceleration: 'prefer-hardware'}});
      return [name, {available: true, supported: Boolean(result.supported), smooth: Boolean(result.smooth), powerEfficient: Boolean(result.powerEfficient)}];
    } catch { return [name, {available: true, supported: false, smooth: false, powerEfficient: false}]; }
  }));
  return Object.fromEntries(results);
}

export async function collectCapabilities({navigatorLike = globalThis.navigator, mediaSourceLike = globalThis.MediaSource, videoDecoderLike = globalThis.VideoDecoder, rtcPeerConnection = globalThis.RTCPeerConnection, screenLike = globalThis.screen, matchMediaLike = globalThis.matchMedia, now = () => new Date().toISOString()} = {}) {
  const navigatorValue = navigatorLike || {}; const gpu = navigatorValue.gpu; let webgpuAdapter = false;
  if (gpu?.requestAdapter) { try { webgpuAdapter = Boolean(await gpu.requestAdapter()); } catch { webgpuAdapter = false; } }
  const codecs = Object.fromEntries(Object.entries(CODEC_PROBES).map(([name, mime]) => [name, supported(mediaSourceLike, mime) || Boolean(videoDecoderLike?.isConfigSupported && name !== 'opus')]));
  const hardwareDecode = await probeHardwareDecode(navigatorValue.mediaCapabilities, codecs);
  const display = await probeDisplays(navigatorValue, screenLike, matchMediaLike);
  const report = {
    version: 1, collectedAt: now(), browser: {engine: navigatorValue.userAgentData?.brands?.some(brand => /chrom/i.test(brand.brand)) ? 'chromium' : 'unknown', platform: navigatorValue.userAgentData?.platform || navigatorValue.platform || 'unknown'},
    transports: {webrtc: typeof rtcPeerConnection === 'function', webtransport: typeof navigatorValue.WebTransport === 'function', websocket: typeof navigatorValue.WebSocket === 'function' || typeof WebSocket === 'function'},
    graphics: {webgpu: Boolean(gpu), webgpuAdapter, webgl: Boolean(navigatorValue.WebGLRenderingContext || globalThis.WebGLRenderingContext), hdr: display.hdr},
    display,
    input: {gamepad: typeof navigatorValue.getGamepads === 'function', hid: Boolean(navigatorValue.hid), touchPoints: Number(navigatorValue.maxTouchPoints) || 0},
    media: {codecs, hardwareDecode, hardwareDecodeApi: typeof videoDecoderLike === 'function', mediaDevices: Boolean(navigatorValue.mediaDevices)},
    hardware: {logicalProcessors: Number(navigatorValue.hardwareConcurrency) || null, memoryGb: Number(navigatorValue.deviceMemory) || null},
  };
  report.recommendations = recommendCapabilities(report);
  return Object.freeze(report);
}

export function recommendCapabilities(report) {
  const recommendations = [];
  if (!report.transports.webrtc) recommendations.push({severity: 'error', key: 'webrtc', message: 'WebRTC is unavailable; remote streaming sessions cannot start in this browser.'});
  if (!report.graphics.webgpu && !report.graphics.webgl) recommendations.push({severity: 'warning', key: 'graphics', message: 'No browser graphics API was detected; browser emulation and 3D games may be unavailable.'});
  if (!report.media.hardwareDecodeApi) recommendations.push({severity: 'info', key: 'decode', message: 'The hardware decode API is unavailable; stream playback may use a compatibility path.'});
  if (report.media.hardwareDecodeApi && report.media.hardwareDecode && Object.values(report.media.hardwareDecode).some(codec => codec.supported) && !Object.values(report.media.hardwareDecode).some(codec => codec.powerEfficient)) recommendations.push({severity: 'info', key: 'hardware-decode', message: 'No tested codec reported a power-efficient hardware decode path; prefer balanced stream settings until playback is verified.'});
  if (!report.input.gamepad) recommendations.push({severity: 'warning', key: 'gamepad', message: 'Gamepad access is unavailable; use keyboard, touch, or an approved HID device.'});
  if (!report.media.codecs.av1 && !report.media.codecs.vp9 && !report.media.codecs.h264) recommendations.push({severity: 'error', key: 'codecs', message: 'No supported video codec was detected for stream playback.'});
  return Object.freeze(recommendations.map(item => Object.freeze(item)));
}

export function redactDiagnostics(report) {
  return Object.freeze({version: report.version, collectedAt: report.collectedAt, browser: {engine: report.browser.engine}, transports: report.transports, graphics: report.graphics, display: report.display, input: {gamepad: report.input.gamepad, hid: report.input.hid, touchPoints: report.input.touchPoints > 0}, media: report.media, hardware: {logicalProcessors: report.hardware.logicalProcessors, memoryGb: report.hardware.memoryGb}, recommendations: report.recommendations});
}
