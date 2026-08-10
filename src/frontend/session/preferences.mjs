import {createSettingsStore} from '../settings/profile.mjs';
import {resolveDisplayPolicy} from '../display/policy.mjs';
import {createQualityProfiles} from './quality.mjs';
import {createWorkspaceStore, resolveWorkspaceControllerProfile, resolveWorkspaceQualityPreset} from '../workspaces/workspaces.mjs';
import {createControllerProfileStore, resolveControllerProfile} from '../input/profiles.mjs';
import {resolveControllerPreferences} from '../input/inspector.mjs';

const RESOLUTIONS = Object.freeze({ '720p': [1280, 720], '1080p': [1920, 1080], '1440p': [2560, 1440], '4K': [3840, 2160], Source: [3840, 2160] });
const QUALITY = Object.freeze({'Prefer latency': 'low', Balanced: 'balanced', 'Prefer quality': 'high', Custom: 'balanced'});
const CODECS = Object.freeze({Automatic: null, AV1: 'av1', VP9: 'vp9', 'H.264': 'h264'});
const CONTROLLER_LAYOUTS = Object.freeze({
  'Xbox layout': Object.freeze({confirm: 'button-0', cancel: 'button-1', menu: 'button-9', pause: 'button-8', moveUp: 'axis-1-negative', moveDown: 'axis-1-positive', moveLeft: 'axis-0-negative', moveRight: 'axis-0-positive'}),
  'PlayStation layout': Object.freeze({confirm: 'button-1', cancel: 'button-0', menu: 'button-9', pause: 'button-8', moveUp: 'axis-1-negative', moveDown: 'axis-1-positive', moveLeft: 'axis-0-negative', moveRight: 'axis-0-positive'}),
  'Nintendo layout': Object.freeze({confirm: 'button-1', cancel: 'button-0', menu: 'button-9', pause: 'button-8', moveUp: 'axis-1-negative', moveDown: 'axis-1-positive', moveLeft: 'axis-0-negative', moveRight: 'axis-0-positive'}),
  'Keyboard and mouse': Object.freeze({confirm: 'key-Enter', cancel: 'key-Escape', menu: 'key-Tab', pause: 'key-P'}),
});

function numberBeforeUnit(value, fallback) { const number = Number.parseInt(String(value), 10); return Number.isFinite(number) ? number : fallback; }
function volume(value) { const number = Number(value); return Number.isFinite(number) ? Math.max(0, Math.min(1, number / 100)) : 1; }
function boundedOption(value, options, fallback) { return options.includes(value) ? value : fallback; }
function normalizeCustomSignalingUrl(value) { try { const url = new URL(String(value || '')); const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.hostname.endsWith('.local'); if (url.protocol !== 'wss:' && !(url.protocol === 'ws:' && local)) return null; url.username = ''; url.password = ''; url.hash = ''; return url.toString(); } catch { return null; } }

export function createSessionPreferences(settings = {}, capabilities, workspace = null, controllerProfiles = []) {
  const displayPolicy = resolveDisplayPolicy({settings, capabilities});
  const resolution = RESOLUTIONS[settings['streaming.resolution']] || RESOLUTIONS['1080p'];
  const maxFramerate = displayPolicy.maxRefreshRate || numberBeforeUnit(settings['streaming.framerate'], 60);
  const bitrateKbps = Math.max(2000, Math.min(100000, numberBeforeUnit(settings['streaming.bitrate'], 25) * 1000));
  const qualityPreset = workspace?.quality && workspace.quality !== 'balanced' ? (resolveWorkspaceQualityPreset(workspace) || 'balanced') : (QUALITY[settings['streaming.qualityPreset']] || 'balanced');
  const preferredCodec = CODECS[settings['streaming.codec']] ?? null;
  const negotiatedCodecs = preferredCodec && displayPolicy.codecs.includes(preferredCodec)
    ? [preferredCodec, ...displayPolicy.codecs.filter(codec => codec !== preferredCodec)]
    : [...displayPolicy.codecs];
  const qualityProfiles = createQualityProfiles({maxWidth: resolution[0], maxHeight: resolution[1], maxFramerate, bitrateKbps});
  const controllerSettings = resolveControllerPreferences(settings);
  const requestedControllerProfile = resolveWorkspaceControllerProfile(workspace || {}, controllerSettings.defaultProfile);
  const storedControllerProfile = resolveControllerProfile({profileId: requestedControllerProfile, profiles: controllerProfiles});
  const isCustomControllerProfile = Boolean(storedControllerProfile && controllerProfiles.some(profile => profile.id === storedControllerProfile.id));
  const controllerProfile = storedControllerProfile?.name || requestedControllerProfile;
  const controllerBindings = storedControllerProfile?.bindings || CONTROLLER_LAYOUTS[controllerProfile] || CONTROLLER_LAYOUTS['Xbox layout'];
  const controllerDeadzone = isCustomControllerProfile ? storedControllerProfile.deadzone : Math.max(0, Math.min(0.3, numberBeforeUnit(settings['controllers.deadzone'], 8) / 100));
  const replayLengthSeconds = Math.max(15, Math.min(120, numberBeforeUnit(settings['gaming.replayLength'], 30)));
  const recordingCodec = ['Automatic', 'AV1', 'VP9', 'H.264'].includes(settings['media.recordingCodec']) ? settings['media.recordingCodec'] : 'Automatic';
  const recordingLocation = ['Videos/Spartan Gaming', 'Desktop', 'Ask each time', 'Custom folder'].includes(settings['media.recordingLocation']) ? settings['media.recordingLocation'] : 'Videos/Spartan Gaming';
  const audioOutput = ['System default', 'Headphones', 'Speakers', 'HDMI/Display'].includes(settings['media.audioOutput']) ? settings['media.audioOutput'] : 'System default';
  const audioInput = ['System default', 'No microphone', 'Ask each time'].includes(settings['media.audioInput']) ? settings['media.audioInput'] : 'System default';
  const {allowHid, adaptiveTriggers, gyro} = controllerSettings;
  const host = Object.freeze({captureSource: boundedOption(settings['host.captureSource'], ['Automatic', 'Primary display', 'Selected display', 'Selected window'], 'Automatic'), videoCodec: boundedOption(settings['host.videoCodec'], ['Automatic', 'H.264', 'VP9', 'AV1', 'HEVC'], 'Automatic'), maxResolution: boundedOption(settings['host.maxResolution'], ['720p', '1080p', '1440p', '4K', 'Source'], '1080p'), maxFramerate: boundedOption(settings['host.maxFramerate'], ['30 FPS', '60 FPS', '90 FPS', '120 FPS', '144 FPS'], '60 FPS'), captureSystemAudio: settings['host.captureSystemAudio'] !== false, captureMicrophone: settings['host.captureMicrophone'] === true, audioCodec: boundedOption(settings['host.audioCodec'], ['Automatic', 'Opus', 'AAC'], 'Automatic'), allowInputInjection: settings['host.allowInputInjection'] !== false, requireExplicitPairing: settings['host.requireExplicitPairing'] !== false, wakeOnLan: settings['host.wakeOnLan'] === true, sessionPort: Math.max(1024, Math.min(65535, numberBeforeUnit(settings['host.sessionPort'], 8787))), logLevel: boundedOption(settings['host.logLevel'], ['Errors only', 'Connection events', 'Verbose'], 'Connection events')});
  const customSignalingUrl = normalizeCustomSignalingUrl(settings['advanced.customSignalingUrl']);
  const preferences = Object.freeze({qualityPreset, preferredCodec, bitrateKbps, qualityProfiles, adaptiveBitrate: settings['streaming.adaptiveBitrate'] !== false, adaptiveResolution: settings['streaming.adaptiveResolution'] !== false, lowLatencyMode: settings['streaming.lowLatencyMode'] !== false, jitterBufferMs: Math.max(0, Math.min(500, numberBeforeUnit(settings['streaming.jitterBuffer'], 60))), hardwareDecode: settings['streaming.hardwareDecode'] !== false, autoFullscreen: settings['gaming.autoFullscreen'] !== false, pauseOnBlur: settings['gaming.pauseOnBlur'] === true, pictureInPicture: settings['gaming.pictureInPicture'] !== false, hideBrowserChrome: settings['gaming.hideBrowserChrome'] !== false, showOverlay: workspace?.overlay === false ? false : settings['gaming.showOverlay'] !== false, instantReplay: settings['gaming.instantReplay'] === true, replayLengthSeconds, showTelemetry: settings['streaming.showTelemetry'] === true, sessionTelemetry: settings['privacy.sessionTelemetry'] !== false, restoreSession: settings['general.restoreSession'] !== false, gameVolume: volume(settings['media.gameVolume']), chatVolume: volume(settings['media.chatVolume']), spatialAudio: settings['media.spatialAudio'] === true, monoAudio: settings['accessibility.monoAudio'] === true, audioOutput, audioInput, microphoneNoiseSuppression: settings['media.micNoiseSuppression'] !== false, recordingCodec, recordingLocation, clearOnExit: settings['privacy.clearOnExit'] === true, touchLayout: String(settings['accessibility.touchLayout'] || 'Automatic'), controllerProfile, controllerDeadzone, controllerBindings, inputPolling: controllerSettings.inputPolling, allowHid, adaptiveTriggers, gyro, controllerSettings, host, customSignalingUrl, workspaceId: workspace?.id || null, display: displayPolicy.display, maxRefreshRate: displayPolicy.maxRefreshRate, displayPolicy});
  return Object.freeze({capabilities: Object.freeze({video: Object.freeze({codecs: Object.freeze(negotiatedCodecs), maxWidth: resolution[0], maxHeight: resolution[1], maxFramerate, hdr: displayPolicy.hdr}), audio: Object.freeze({codecs: Object.freeze(['opus', 'aac']), channels: 2, spatialAudio: settings['media.spatialAudio'] === true, mono: settings['accessibility.monoAudio'] === true}), input: Object.freeze({gamepad: controllerSettings.allowGamepad, keyboard: true, pointer: true, rumble: controllerSettings.rumble && storedControllerProfile?.rumble !== false, hid: allowHid, adaptiveTriggers, gyro, multipleControllers: controllerSettings.multipleControllers, playerSlots: controllerSettings.playerSlots, inputMode: controllerSettings.inputMode, virtualGamepadBackend: controllerSettings.virtualGamepadBackend, hapticsBackend: controllerSettings.hapticsBackend, touchpad: controllerSettings.touchpad, backButtons: controllerSettings.backButtons, triggerMode: controllerSettings.triggerMode, steeringRange: controllerSettings.steeringRange, splitInput: controllerSettings.splitInput})}), preferences});
}

export function readSessionPreferences(storage = globalThis.localStorage, capabilities, {workspaceStorage = storage} = {}) { const settings = createSettingsStore({storage}).read(); const workspace = createWorkspaceStore({storage: workspaceStorage}).active; const controllerProfiles = createControllerProfileStore({storage: workspaceStorage}).list(); return createSessionPreferences(settings, capabilities, workspace, controllerProfiles); }
