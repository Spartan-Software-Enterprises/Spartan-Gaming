import {createSettingsStore} from '../settings/profile.mjs';
import {resolveDisplayPolicy} from '../display/policy.mjs';
import {createQualityProfiles} from './quality.mjs';

const RESOLUTIONS = Object.freeze({ '720p': [1280, 720], '1080p': [1920, 1080], '1440p': [2560, 1440], '4K': [3840, 2160], Source: [3840, 2160] });
const QUALITY = Object.freeze({'Prefer latency': 'low', Balanced: 'balanced', 'Prefer quality': 'high', Custom: 'balanced'});

function numberBeforeUnit(value, fallback) { const number = Number.parseInt(String(value), 10); return Number.isFinite(number) ? number : fallback; }

export function createSessionPreferences(settings = {}, capabilities) {
  const displayPolicy = resolveDisplayPolicy({settings, capabilities});
  const resolution = RESOLUTIONS[settings['streaming.resolution']] || RESOLUTIONS['1080p'];
  const maxFramerate = displayPolicy.maxRefreshRate || numberBeforeUnit(settings['streaming.framerate'], 60);
  const bitrateKbps = Math.max(2000, Math.min(100000, numberBeforeUnit(settings['streaming.bitrate'], 25) * 1000));
  const qualityPreset = QUALITY[settings['streaming.qualityPreset']] || 'balanced';
  const qualityProfiles = createQualityProfiles({maxWidth: resolution[0], maxHeight: resolution[1], maxFramerate, bitrateKbps});
  const preferences = Object.freeze({qualityPreset, bitrateKbps, qualityProfiles, adaptiveBitrate: settings['streaming.adaptiveBitrate'] !== false, adaptiveResolution: settings['streaming.adaptiveResolution'] !== false, lowLatencyMode: settings['streaming.lowLatencyMode'] !== false, jitterBufferMs: Math.max(0, Math.min(500, numberBeforeUnit(settings['streaming.jitterBuffer'], 60))), hardwareDecode: settings['streaming.hardwareDecode'] !== false, autoFullscreen: settings['gaming.autoFullscreen'] !== false, pictureInPicture: settings['gaming.pictureInPicture'] !== false, hideBrowserChrome: settings['gaming.hideBrowserChrome'] !== false, showOverlay: settings['gaming.showOverlay'] !== false, touchLayout: String(settings['accessibility.touchLayout'] || 'Automatic'), display: displayPolicy.display, maxRefreshRate: displayPolicy.maxRefreshRate, displayPolicy});
  return Object.freeze({capabilities: Object.freeze({video: Object.freeze({codecs: Object.freeze(displayPolicy.codecs), maxWidth: resolution[0], maxHeight: resolution[1], maxFramerate, hdr: displayPolicy.hdr}), audio: Object.freeze({codecs: Object.freeze(['opus', 'aac']), channels: 2}), input: Object.freeze({gamepad: settings['controllers.allowGamepad'] !== false, keyboard: true, pointer: true, rumble: settings['controllers.rumble'] !== false})}), preferences});
}

export function readSessionPreferences(storage = globalThis.localStorage, capabilities) { return createSessionPreferences(createSettingsStore({storage}).read(), capabilities); }
