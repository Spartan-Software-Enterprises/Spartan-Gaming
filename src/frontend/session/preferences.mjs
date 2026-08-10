import {createSettingsStore} from '../settings/profile.mjs';
import {resolveDisplayPolicy} from '../display/policy.mjs';
import {createQualityProfiles} from './quality.mjs';
import {createWorkspaceStore, resolveWorkspaceControllerProfile, resolveWorkspaceQualityPreset} from '../workspaces/workspaces.mjs';
import {createControllerProfileStore, resolveControllerProfile} from '../input/profiles.mjs';
import {resolveControllerPreferences} from '../input/inspector.mjs';
import {resolvePowerQualityPolicy} from './power-policy.mjs';

const RESOLUTIONS = Object.freeze({ '720p': [1280, 720], '1080p': [1920, 1080], '1440p': [2560, 1440], '4K': [3840, 2160], Source: [3840, 2160] });
const QUALITY = Object.freeze({'Prefer latency': 'low', Balanced: 'balanced', 'Prefer quality': 'high', Custom: 'balanced'});
const CODECS = Object.freeze({Automatic: null, AV1: 'av1', VP9: 'vp9', 'H.264': 'h264'});
const NETWORK_BITRATE_CAPS = Object.freeze({Automatic: 100000, Wired: 100000, 'Wi-Fi': 50000, 'Mobile/metered': 10000});
const MOBILE_DATA_SAVER_CAP = 6000;
const SESSION_PRIORITIES = Object.freeze(['Balanced', 'Game priority', 'Maximum game priority']);
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

export function createSessionPreferences(settings = {}, capabilities, workspace = null, controllerProfiles = [], {controllerProfile: controllerProfileOverride, powerState = {}} = {}) {
  const displayPolicy = resolveDisplayPolicy({settings, capabilities});
  const resolution = RESOLUTIONS[settings['streaming.resolution']] || RESOLUTIONS['1080p'];
  const maxFramerate = displayPolicy.maxRefreshRate || numberBeforeUnit(settings['streaming.framerate'], 60);
  const networkMode = boundedOption(settings['streaming.networkMode'], Object.keys(NETWORK_BITRATE_CAPS), 'Automatic');
  const mobileDataSaver = settings['mobile.dataSaver'] === true;
  const requestedBitrateKbps = Math.max(2000, Math.min(NETWORK_BITRATE_CAPS[networkMode], mobileDataSaver ? MOBILE_DATA_SAVER_CAP : Infinity, numberBeforeUnit(settings['streaming.bitrate'], 25) * 1000));
  const qualityPreset = workspace?.quality && workspace.quality !== 'balanced' ? (resolveWorkspaceQualityPreset(workspace) || 'balanced') : (QUALITY[settings['streaming.qualityPreset']] || 'balanced');
  const preferredCodec = CODECS[settings['streaming.codec']] ?? null;
  const negotiatedCodecs = preferredCodec && displayPolicy.codecs.includes(preferredCodec)
    ? [preferredCodec, ...displayPolicy.codecs.filter(codec => codec !== preferredCodec)]
    : [...displayPolicy.codecs];
  const powerPolicy = resolvePowerQualityPolicy({mode: settings['performance.powerMode'], ...powerState});
  const effectiveWidth = Math.min(resolution[0], powerPolicy.limits.maxWidth);
  const effectiveHeight = Math.min(resolution[1], powerPolicy.limits.maxHeight);
  const effectiveFramerate = Math.min(maxFramerate, powerPolicy.limits.maxFramerate);
  const bitrateKbps = Math.min(requestedBitrateKbps, powerPolicy.limits.bitrateKbps);
  const qualityProfiles = createQualityProfiles({maxWidth: effectiveWidth, maxHeight: effectiveHeight, maxFramerate: effectiveFramerate, bitrateKbps});
  const controllerSettings = resolveControllerPreferences(settings);
  const forceSoftwareDecode = settings['advanced.forceSoftwareDecode'] === true || settings['performance.forceSoftwareDecode'] === true;
  const workspaceControllerProfile = resolveWorkspaceControllerProfile(workspace || {}, controllerSettings.defaultProfile);
  const requestedControllerProfile = typeof controllerProfileOverride === 'string' && controllerProfileOverride.trim() ? controllerProfileOverride.trim().slice(0, 80) : workspaceControllerProfile;
  const selectedControllerProfile = resolveControllerProfile({profileId: requestedControllerProfile, profiles: controllerProfiles});
  const workspaceStoredControllerProfile = resolveControllerProfile({profileId: workspaceControllerProfile, profiles: controllerProfiles});
  const storedControllerProfile = selectedControllerProfile || workspaceStoredControllerProfile;
  const effectiveControllerProfile = selectedControllerProfile ? requestedControllerProfile : (workspaceStoredControllerProfile ? workspaceControllerProfile : controllerSettings.defaultProfile);
  const isCustomControllerProfile = Boolean(storedControllerProfile && controllerProfiles.some(profile => profile.id === storedControllerProfile.id));
  const controllerProfile = storedControllerProfile?.name || effectiveControllerProfile;
  const controllerBindings = storedControllerProfile?.bindings || CONTROLLER_LAYOUTS[controllerProfile] || CONTROLLER_LAYOUTS['Xbox layout'];
  const controllerDeadzone = isCustomControllerProfile ? storedControllerProfile.deadzone : Math.max(0, Math.min(0.3, numberBeforeUnit(settings['controllers.deadzone'], 8) / 100));
  const controllerCapabilities = storedControllerProfile?.capabilities || [];
  const profileSupports = capability => !storedControllerProfile || !controllerCapabilities.length || controllerCapabilities.includes(capability);
  const replayLengthSeconds = Math.max(15, Math.min(120, numberBeforeUnit(settings['gaming.replayLength'], 30)));
  const sessionPriority = boundedOption(settings['gaming.sessionPriority'], SESSION_PRIORITIES, 'Game priority');
  const recordingCodec = ['Automatic', 'AV1', 'VP9', 'H.264'].includes(settings['media.recordingCodec']) ? settings['media.recordingCodec'] : 'Automatic';
  const recordingLocation = ['Videos/Spartan Gaming', 'Desktop', 'Ask each time', 'Custom folder'].includes(settings['media.recordingLocation']) ? settings['media.recordingLocation'] : 'Videos/Spartan Gaming';
  const audioOutput = ['System default', 'Headphones', 'Speakers', 'HDMI/Display'].includes(settings['media.audioOutput']) ? settings['media.audioOutput'] : 'System default';
  const audioInput = ['System default', 'No microphone', 'Ask each time'].includes(settings['media.audioInput']) ? settings['media.audioInput'] : 'System default';
  const captionMode = ['Off', 'On'].includes(settings['accessibility.captionMode']) ? settings['accessibility.captionMode'] : 'Off';
  const captionLanguage = ['Automatic', 'English', 'Spanish', 'French', 'German', 'Japanese'].includes(settings['accessibility.captionLanguage']) ? settings['accessibility.captionLanguage'] : 'Automatic';
  const {allowHid} = controllerSettings;
  const adaptiveTriggers = controllerSettings.adaptiveTriggers && profileSupports('adaptiveTriggers');
  const gyro = controllerSettings.gyro && profileSupports('gyro');
  const touchpad = controllerSettings.touchpad && profileSupports('touchpad');
  const trackpads = controllerSettings.trackpads && profileSupports('trackpads');
  const backButtons = controllerSettings.backButtons && profileSupports('backButtons');
  const touchscreen = controllerSettings.touchscreen && profileSupports('touchscreen');
  const textEntry = controllerSettings.textEntry && profileSupports('textEntry');
  const controllerNavigation = controllerSettings.controllerNavigation && controllerSettings.allowGamepad;
  const splitInput = controllerSettings.splitInput && profileSupports('splitInput');
  const rumble = controllerSettings.rumble && storedControllerProfile?.rumble !== false && profileSupports('haptics');
  const host = Object.freeze({captureSource: boundedOption(settings['host.captureSource'], ['Automatic', 'Primary display', 'Selected display', 'Selected window'], 'Automatic'), videoCodec: boundedOption(settings['host.videoCodec'], ['Automatic', 'H.264', 'VP9', 'AV1', 'HEVC'], 'Automatic'), maxResolution: boundedOption(settings['host.maxResolution'], ['720p', '1080p', '1440p', '4K', 'Source'], '1080p'), maxFramerate: boundedOption(settings['host.maxFramerate'], ['30 FPS', '60 FPS', '90 FPS', '120 FPS', '144 FPS'], '60 FPS'), captureSystemAudio: settings['host.captureSystemAudio'] !== false, captureMicrophone: settings['host.captureMicrophone'] === true, audioCodec: boundedOption(settings['host.audioCodec'], ['Automatic', 'Opus', 'AAC'], 'Automatic'), allowInputInjection: settings['host.allowInputInjection'] !== false, requireExplicitPairing: settings['host.requireExplicitPairing'] !== false, wakeOnLan: settings['host.wakeOnLan'] === true, sessionPort: Math.max(1024, Math.min(65535, numberBeforeUnit(settings['host.sessionPort'], 8787))), logLevel: boundedOption(settings['host.logLevel'], ['Errors only', 'Connection events', 'Verbose'], 'Connection events')});
  const customSignalingUrl = normalizeCustomSignalingUrl(settings['advanced.customSignalingUrl']);
  const preferences = Object.freeze({qualityPreset, preferredCodec, bitrateKbps, networkMode, mobileDataSaver, powerPolicy, qualityProfiles, adaptiveBitrate: settings['streaming.adaptiveBitrate'] !== false, adaptiveResolution: settings['streaming.adaptiveResolution'] !== false, lowLatencyMode: settings['streaming.lowLatencyMode'] !== false, jitterBufferMs: Math.max(0, Math.min(500, numberBeforeUnit(settings['streaming.jitterBuffer'], 60))), hardwareDecode: settings['streaming.hardwareDecode'] !== false && !forceSoftwareDecode, autoFullscreen: settings['gaming.autoFullscreen'] !== false, pauseOnBlur: settings['gaming.pauseOnBlur'] === true, sessionPriority, autoSuspendTabs: settings['gaming.autoSuspendTabs'] !== false, pictureInPicture: settings['gaming.pictureInPicture'] !== false && settings['mobile.pictureInPicture'] !== false, hideBrowserChrome: settings['gaming.hideBrowserChrome'] !== false, showOverlay: workspace?.overlay === false ? false : settings['gaming.showOverlay'] !== false, instantReplay: settings['gaming.instantReplay'] === true, replayLengthSeconds, showTelemetry: settings['streaming.showTelemetry'] === true, sessionTelemetry: settings['privacy.sessionTelemetry'] !== false, restoreSession: settings['general.restoreSession'] !== false, stickyKeys: settings['accessibility.stickyKeys'] === true, gameVolume: volume(settings['media.gameVolume']), chatVolume: volume(settings['media.chatVolume']), spatialAudio: settings['media.spatialAudio'] === true, monoAudio: settings['accessibility.monoAudio'] === true, captionMode, captionLanguage, audioOutput, audioInput, microphoneNoiseSuppression: settings['media.micNoiseSuppression'] !== false, recordingCodec, recordingLocation, clearOnExit: settings['privacy.clearOnExit'] === true, touchLayout: String(settings['accessibility.touchLayout'] || 'Automatic'), mobile: Object.freeze({orientation: boundedOption(settings['mobile.orientation'], ['Automatic', 'Landscape', 'Portrait'], 'Automatic'), keepScreenAwake: settings['mobile.keepScreenAwake'] !== false, edgeToEdge: settings['mobile.edgeToEdge'] !== false, gameMode: boundedOption(settings['mobile.gameMode'], ['Follow system', 'Performance', 'Battery', 'Standard'], 'Follow system')}), controllerProfile, controllerProfileSelection: effectiveControllerProfile, controllerCapabilities, controllerDeadzone, controllerBindings, inputPolling: controllerSettings.inputPolling, glyphStyle: controllerSettings.glyphStyle, allowHid, adaptiveTriggers, gyro, touchpad, trackpads, backButtons, touchscreen, textEntry, controllerNavigation, splitInput, rumble, controllerSettings, host, customSignalingUrl, workspaceId: workspace?.id || null, display: displayPolicy.display, maxRefreshRate: displayPolicy.maxRefreshRate, displayPolicy});
  return Object.freeze({capabilities: Object.freeze({video: Object.freeze({codecs: Object.freeze(negotiatedCodecs), maxWidth: effectiveWidth, maxHeight: effectiveHeight, maxFramerate: effectiveFramerate, hdr: displayPolicy.hdr}), audio: Object.freeze({codecs: Object.freeze(['opus', 'aac']), channels: 2, spatialAudio: settings['media.spatialAudio'] === true, mono: settings['accessibility.monoAudio'] === true}), input: Object.freeze({gamepad: controllerSettings.allowGamepad, keyboard: true, pointer: true, rumble, hid: allowHid, adaptiveTriggers, gyro, multipleControllers: controllerSettings.multipleControllers, playerSlots: controllerSettings.playerSlots, inputMode: controllerSettings.inputMode, virtualGamepadBackend: controllerSettings.virtualGamepadBackend, hapticsBackend: controllerSettings.hapticsBackend, touchpad, trackpads, backButtons, touchscreen, textEntry, controllerNavigation, triggerMode: controllerSettings.triggerMode, steeringRange: controllerSettings.steeringRange, splitInput})}), preferences});
}

export function readSessionPreferences(storage = globalThis.localStorage, capabilities, {workspaceStorage = storage, controllerProfile} = {}) { const settings = createSettingsStore({storage}).read(); const workspace = createWorkspaceStore({storage: workspaceStorage}).active; const controllerProfiles = createControllerProfileStore({storage: workspaceStorage}).list(); return createSessionPreferences(settings, capabilities, workspace, controllerProfiles, {controllerProfile}); }
