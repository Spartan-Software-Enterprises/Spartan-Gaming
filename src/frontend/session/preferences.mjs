import {createSettingsStore} from '../settings/profile.mjs';

const RESOLUTIONS = Object.freeze({ '720p': [1280, 720], '1080p': [1920, 1080], '1440p': [2560, 1440], '4K': [3840, 2160], Source: [3840, 2160] });
const CODECS = Object.freeze({ Automatic: ['av1', 'vp9', 'h264'], AV1: ['av1', 'vp9', 'h264'], VP9: ['vp9', 'h264'], 'H.264': ['h264'] });
const QUALITY = Object.freeze({'Prefer latency': 'low', Balanced: 'balanced', 'Prefer quality': 'high', Custom: 'balanced'});

function numberBeforeUnit(value, fallback) { const number = Number.parseInt(String(value), 10); return Number.isFinite(number) ? number : fallback; }

export function createSessionPreferences(settings = {}) {
  const resolution = RESOLUTIONS[settings['streaming.resolution']] || RESOLUTIONS['1080p'];
  const maxFramerate = numberBeforeUnit(settings['streaming.framerate'], 60);
  const bitrateKbps = Math.max(2000, Math.min(100000, numberBeforeUnit(settings['streaming.bitrate'], 25) * 1000));
  const qualityPreset = QUALITY[settings['streaming.qualityPreset']] || 'balanced';
  const preferences = Object.freeze({qualityPreset, bitrateKbps, adaptiveBitrate: settings['streaming.adaptiveBitrate'] !== false, adaptiveResolution: settings['streaming.adaptiveResolution'] !== false, lowLatencyMode: settings['streaming.lowLatencyMode'] !== false, jitterBufferMs: Math.max(0, Math.min(500, numberBeforeUnit(settings['streaming.jitterBuffer'], 60))), hardwareDecode: settings['streaming.hardwareDecode'] !== false});
  return Object.freeze({capabilities: Object.freeze({video: Object.freeze({codecs: Object.freeze([...(CODECS[settings['streaming.codec']] || CODECS.Automatic)]), maxWidth: resolution[0], maxHeight: resolution[1], maxFramerate, hdr: settings['media.hdr'] === true}), audio: Object.freeze({codecs: Object.freeze(['opus', 'aac']), channels: 2}), input: Object.freeze({gamepad: settings['controllers.allowGamepad'] !== false, keyboard: true, pointer: true, rumble: settings['controllers.rumble'] !== false})}), preferences});
}

export function readSessionPreferences(storage = globalThis.localStorage) { return createSessionPreferences(createSettingsStore({storage}).read()); }
