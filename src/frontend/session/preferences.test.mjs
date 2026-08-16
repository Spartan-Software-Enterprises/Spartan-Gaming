import assert from 'node:assert/strict';
import test from 'node:test';
import { createSessionPreferences } from './preferences.mjs';

test('session preferences map streaming settings into bounded capabilities', () => {
  const result = createSessionPreferences({
    'streaming.resolution': '1440p',
    'streaming.framerate': '120 FPS',
    'streaming.codec': 'VP9',
    'streaming.bitrate': 40,
    'streaming.qualityPreset': 'Prefer latency',
    'media.hdr': true,
    'controllers.allowGamepad': false,
  });
  assert.deepEqual(result.capabilities.video.codecs, ['vp9', 'h264']);
  assert.equal(result.capabilities.video.maxWidth, 2560);
  assert.equal(result.capabilities.video.maxFramerate, 120);
  assert.equal(result.capabilities.video.hdr, true);
  assert.equal(result.capabilities.input.gamepad, false);
  assert.equal(result.preferences.qualityPreset, 'low');
  assert.equal(result.preferences.bitrateKbps, 40000);
  assert.equal(
    result.preferences.qualityProfiles.find((profile) => profile.id === 'high').maxWidth,
    2560,
  );
  assert.equal(result.preferences.autoFullscreen, true);
  assert.equal(result.preferences.pictureInPicture, true);
  assert.equal(result.preferences.showOverlay, true);
});

test('session preferences fall back safely for invalid settings', () => {
  const result = createSessionPreferences({
    'streaming.bitrate': 'not-a-number',
    'streaming.framerate': 'bad',
    'streaming.codec': 'unknown',
  });
  assert.equal(result.capabilities.video.maxWidth, 1920);
  assert.equal(result.capabilities.video.maxFramerate, 60);
  assert.deepEqual(result.capabilities.video.codecs, ['av1', 'vp9', 'h264']);
  assert.equal(result.preferences.bitrateKbps, 25000);
  assert.equal(
    result.preferences.qualityProfiles.find((profile) => profile.id === 'ultra').maxWidth,
    1920,
  );
  assert.equal(result.preferences.autoFullscreen, true);
});
test('force software decode honors the advanced setting and legacy alias', () => {
  assert.equal(
    createSessionPreferences({
      'streaming.hardwareDecode': true,
      'advanced.forceSoftwareDecode': true,
    }).preferences.hardwareDecode,
    false,
  );
  assert.equal(
    createSessionPreferences({
      'streaming.hardwareDecode': true,
      'performance.forceSoftwareDecode': true,
    }).preferences.hardwareDecode,
    false,
  );
  assert.equal(
    createSessionPreferences({
      'streaming.hardwareDecode': true,
      'advanced.forceSoftwareDecode': false,
    }).preferences.hardwareDecode,
    true,
  );
});
test('network mode caps session bitrate for metered links without changing wired defaults', () => {
  const mobile = createSessionPreferences({
    'streaming.bitrate': 40,
    'streaming.networkMode': 'Mobile/metered',
  });
  assert.equal(mobile.preferences.networkMode, 'Mobile/metered');
  assert.equal(mobile.preferences.bitrateKbps, 10000);
  const wired = createSessionPreferences({
    'streaming.bitrate': 40,
    'streaming.networkMode': 'Wired',
  });
  assert.equal(wired.preferences.bitrateKbps, 40000);
});
test('Android mobile data saver caps bitrate and mobile PiP is independently gated', () => {
  const result = createSessionPreferences({ 'streaming.bitrate': 40, 'mobile.dataSaver': true });
  assert.equal(result.preferences.mobileDataSaver, true);
  assert.equal(result.preferences.bitrateKbps, 6000);
  assert.equal(
    createSessionPreferences({ 'gaming.pictureInPicture': true, 'mobile.pictureInPicture': false })
      .preferences.pictureInPicture,
    false,
  );
});
test('Android mobile session policy is carried into the shared preference contract', () => {
  const result = createSessionPreferences({
    'mobile.orientation': 'Landscape',
    'mobile.keepScreenAwake': false,
    'mobile.edgeToEdge': false,
    'mobile.gameMode': 'Performance',
  });
  assert.deepEqual(result.preferences.mobile, {
    orientation: 'Landscape',
    keepScreenAwake: false,
    edgeToEdge: false,
    gameMode: 'Performance',
  });
});
test('session preferences carry bounded display selection and refresh policy', () => {
  const result = createSessionPreferences({
    'media.display': 'Display 2',
    'media.refreshRate': '240 Hz',
  });
  assert.deepEqual(result.preferences.display, { kind: 'index', index: 1 });
  assert.equal(result.preferences.maxRefreshRate, 240);
  const ask = createSessionPreferences({
    'media.display': 'Ask each time',
    'media.refreshRate': 'Automatic',
  });
  assert.equal(ask.preferences.display, 'ask');
  assert.equal(ask.preferences.maxRefreshRate, null);
});
test('session preferences carry the touch-control layout choice', () => {
  assert.equal(
    createSessionPreferences({ 'accessibility.touchLayout': 'Minimal' }).preferences.touchLayout,
    'Minimal',
  );
});
test('session preferences honor the Picture-in-Picture setting', () => {
  assert.equal(
    createSessionPreferences({ 'gaming.pictureInPicture': false }).preferences.pictureInPicture,
    false,
  );
});
test('session preferences carry telemetry visibility and bounded game volume', () => {
  const result = createSessionPreferences({
    'streaming.showTelemetry': true,
    'media.gameVolume': 35,
  });
  assert.equal(result.preferences.showTelemetry, true);
  assert.equal(result.preferences.gameVolume, 0.35);
  assert.equal(createSessionPreferences({ 'media.gameVolume': 150 }).preferences.gameVolume, 1);
});
test('session preferences carry audio mix and processing policy', () => {
  const result = createSessionPreferences({
    'media.gameVolume': 35,
    'media.chatVolume': 55,
    'media.spatialAudio': true,
    'accessibility.monoAudio': true,
    'media.audioInput': 'No microphone',
    'media.micNoiseSuppression': false,
  });
  assert.equal(result.preferences.gameVolume, 0.35);
  assert.equal(result.preferences.chatVolume, 0.55);
  assert.equal(result.preferences.spatialAudio, true);
  assert.equal(result.preferences.monoAudio, true);
  assert.equal(result.preferences.audioInput, 'No microphone');
  assert.equal(result.preferences.microphoneNoiseSuppression, false);
  assert.equal(result.preferences.microphoneNoiseSuppressionProfile, 'off');
  assert.deepEqual(result.capabilities.audio, {
    codecs: ['opus', 'aac'],
    channels: 2,
    spatialAudio: true,
    mono: true,
    voiceChat: false,
  });
});
test('session preferences carry bounded caption settings', () => {
  const result = createSessionPreferences({
    'accessibility.captionMode': 'On',
    'accessibility.captionLanguage': 'Spanish',
  });
  assert.equal(result.preferences.captionMode, 'On');
  assert.equal(result.preferences.captionLanguage, 'Spanish');
  const fallback = createSessionPreferences({
    'accessibility.captionMode': 'unsupported',
    'accessibility.captionLanguage': 'xx',
  });
  assert.equal(fallback.preferences.captionMode, 'Off');
  assert.equal(fallback.preferences.captionLanguage, 'Automatic');
});
test('session preferences prioritize a supported preferred codec while preserving fallback codecs', () => {
  const result = createSessionPreferences({ 'streaming.codec': 'VP9' });
  assert.equal(result.preferences.preferredCodec, 'vp9');
  assert.deepEqual(result.capabilities.video.codecs, ['vp9', 'h264']);
  const unsupported = createSessionPreferences(
    { 'streaming.codec': 'AV1' },
    { media: { codecs: { av1: false, vp9: true, h264: true } } },
  );
  assert.equal(unsupported.preferences.preferredCodec, 'av1');
  assert.deepEqual(unsupported.capabilities.video.codecs, ['vp9', 'h264']);
});
test('session preferences carry validated recording and audio output choices', () => {
  const result = createSessionPreferences({
    'media.recordingCodec': 'H.264',
    'media.recordingLocation': 'Ask each time',
    'media.audioOutput': 'Headphones',
  });
  assert.equal(result.preferences.recordingCodec, 'H.264');
  assert.equal(result.preferences.recordingLocation, 'Ask each time');
  assert.equal(result.preferences.audioOutput, 'Headphones');
  const fallback = createSessionPreferences({
    'media.recordingCodec': 'unsupported',
    'media.recordingLocation': 'unknown',
    'media.audioOutput': 'unknown',
  });
  assert.equal(fallback.preferences.recordingCodec, 'Automatic');
  assert.equal(fallback.preferences.recordingLocation, 'Videos/Spartan Gaming');
  assert.equal(fallback.preferences.audioOutput, 'System default');
});
test('session preferences carry controller layout and bounded dead-zone settings', () => {
  const result = createSessionPreferences({
    'controllers.defaultProfile': 'PlayStation layout',
    'controllers.deadzone': 20,
  });
  assert.equal(result.preferences.controllerProfile, 'PlayStation layout');
  assert.equal(result.preferences.controllerDeadzone, 0.2);
  assert.equal(result.preferences.controllerBindings.confirm, 'button-1');
  assert.equal(
    createSessionPreferences({ 'controllers.deadzone': 100 }).preferences.controllerDeadzone,
    0.3,
  );
});
test('session preferences gate advanced controls through the selected profile capabilities', () => {
  const result = createSessionPreferences({
    'controllers.defaultProfile': 'DualSense / DualShock',
    'controllers.adaptiveTriggers': true,
    'controllers.gyro': true,
    'controllers.touchpad': true,
    'controllers.backButtons': true,
    'controllers.splitInput': true,
  });
  assert.equal(result.capabilities.input.adaptiveTriggers, true);
  assert.equal(result.capabilities.input.gyro, true);
  assert.equal(result.capabilities.input.touchpad, true);
  assert.equal(result.capabilities.input.backButtons, false);
  assert.equal(result.capabilities.input.splitInput, false);
  assert.deepEqual(result.preferences.controllerCapabilities, [
    'touchpad',
    'gyro',
    'adaptiveTriggers',
    'haptics',
    'battery',
  ]);
});
test('session preferences preserve the requested controller selection for runtime auto-detection', () => {
  const result = createSessionPreferences({ 'controllers.defaultProfile': 'Auto-detect' });
  assert.equal(result.preferences.controllerProfileSelection, 'Auto-detect');
  assert.equal(result.preferences.controllerProfile, 'Auto-detect');
  assert.equal(result.preferences.controllerBindings.confirm, 'button-0');
});
test('session preferences carry bounded host capture settings and safe custom signaling URL', () => {
  const result = createSessionPreferences({
    'host.captureSource': 'Selected window',
    'host.videoCodec': 'AV1',
    'host.maxResolution': '4K',
    'host.maxFramerate': '144 FPS',
    'host.captureSystemAudio': false,
    'host.captureMicrophone': true,
    'host.audioCodec': 'Opus',
    'host.allowInputInjection': false,
    'host.requireExplicitPairing': false,
    'host.wakeOnLan': true,
    'host.sessionPort': 99999,
    'host.logLevel': 'Verbose',
    'advanced.customSignalingUrl': 'wss://signal.example/session',
  });
  assert.deepEqual(result.preferences.host, {
    captureSource: 'Selected window',
    videoCodec: 'AV1',
    maxResolution: '4K',
    maxFramerate: '144 FPS',
    captureSystemAudio: false,
    captureMicrophone: true,
    audioCodec: 'Opus',
    allowInputInjection: false,
    requireExplicitPairing: false,
    wakeOnLan: true,
    sessionPort: 65535,
    logLevel: 'Verbose',
  });
  assert.equal(result.preferences.customSignalingUrl, 'wss://signal.example/session');
  assert.equal(
    createSessionPreferences({ 'advanced.customSignalingUrl': 'ws://remote.example/session' })
      .preferences.customSignalingUrl,
    null,
  );
  assert.equal(
    createSessionPreferences({ 'advanced.customSignalingUrl': 'ws://localhost:8790/signal' })
      .preferences.customSignalingUrl,
    'ws://localhost:8790/signal',
  );
});
test('session preferences negotiate the complete controller capability contract', () => {
  const result = createSessionPreferences({
    'controllers.allowHid': true,
    'controllers.adaptiveTriggers': true,
    'controllers.gyro': true,
    'controllers.touchpad': true,
    'controllers.backButtons': true,
    'controllers.multipleControllers': false,
    'controllers.playerSlots': '2',
    'controllers.inputMode': 'XInput',
    'controllers.virtualGamepadBackend': 'Windows external driver',
    'controllers.hapticsBackend': 'Native rumble',
    'controllers.controllerNavigation': true,
    'controllers.triggerMode': 'Digital only',
    'controllers.steeringRange': 540,
    'controllers.splitInput': true,
    'controllers.inputLatency': 'High frequency',
  });
  assert.deepEqual(result.capabilities.input, {
    gamepad: true,
    keyboard: true,
    pointer: true,
    rumble: true,
    hid: true,
    adaptiveTriggers: true,
    gyro: true,
    multipleControllers: false,
    playerSlots: 2,
    inputMode: 'XInput',
    virtualGamepadBackend: 'Windows external driver',
    hapticsBackend: 'Native rumble',
    touchpad: true,
    trackpads: false,
    backButtons: true,
    touchscreen: false,
    textEntry: true,
    controllerNavigation: true,
    triggerMode: 'Digital only',
    steeringRange: 540,
    splitInput: true,
  });
  assert.equal(result.preferences.inputPolling, 'High frequency');
  assert.equal(result.preferences.controllerSettings.playerSlots, 2);
  const fallback = createSessionPreferences({ 'controllers.inputLatency': 'unsupported' });
  assert.equal(fallback.preferences.inputPolling, 'Automatic');
  assert.equal(fallback.capabilities.input.hid, false);
});
test('session preferences carry the bounded instant replay policy', () => {
  const result = createSessionPreferences({
    'gaming.instantReplay': true,
    'gaming.replayLength': '120 seconds',
  });
  assert.equal(result.preferences.instantReplay, true);
  assert.equal(result.preferences.replayLengthSeconds, 120);
  assert.equal(
    createSessionPreferences({ 'gaming.replayLength': 'invalid' }).preferences.replayLengthSeconds,
    30,
  );
});
test('session preferences carry the focus pause policy', () => {
  assert.equal(
    createSessionPreferences({ 'gaming.pauseOnBlur': true }).preferences.pauseOnBlur,
    true,
  );
  assert.equal(createSessionPreferences().preferences.pauseOnBlur, false);
});
test('session preferences carry the sticky modifier-key accessibility setting', () => {
  assert.equal(
    createSessionPreferences({ 'accessibility.stickyKeys': true }).preferences.stickyKeys,
    true,
  );
  assert.equal(createSessionPreferences().preferences.stickyKeys, false);
});
test('session preferences carry the gaming resource policy for host runtimes', () => {
  const result = createSessionPreferences({
    'gaming.sessionPriority': 'Maximum game priority',
    'gaming.autoSuspendTabs': false,
  });
  assert.equal(result.preferences.sessionPriority, 'Maximum game priority');
  assert.equal(result.preferences.autoSuspendTabs, false);
  const fallback = createSessionPreferences({ 'gaming.sessionPriority': 'unsupported' });
  assert.equal(fallback.preferences.sessionPriority, 'Game priority');
  assert.equal(fallback.preferences.autoSuspendTabs, true);
});
test('session preferences inherit active workspace quality, controller, and overlay defaults', () => {
  const result = createSessionPreferences(
    {
      'streaming.qualityPreset': 'Balanced',
      'controllers.defaultProfile': 'Xbox layout',
      'gaming.showOverlay': true,
    },
    undefined,
    { id: 'guest', quality: 'low', controllerProfile: 'keyboard', overlay: true },
  );
  assert.equal(result.preferences.qualityPreset, 'low');
  assert.equal(result.preferences.controllerProfile, 'Keyboard and mouse');
  assert.equal(result.preferences.showOverlay, true);
  const family = createSessionPreferences({}, undefined, {
    id: 'family',
    quality: 'balanced',
    controllerProfile: 'auto',
    overlay: false,
  });
  assert.equal(family.preferences.showOverlay, false);
});
test('session preferences consume a saved custom controller profile selected by workspace', () => {
  const result = createSessionPreferences(
    {},
    undefined,
    { id: 'arcade', quality: 'balanced', controllerProfile: 'arcade-stick', overlay: true },
    [
      {
        id: 'arcade-stick',
        name: 'Arcade stick',
        deviceMatch: 'any',
        bindings: { confirm: 'button-2', cancel: 'button-3' },
        deadzone: 0.04,
        rumble: false,
      },
    ],
  );
  assert.equal(result.preferences.controllerProfile, 'Arcade stick');
  assert.equal(result.preferences.controllerBindings.confirm, 'button-2');
  assert.equal(result.preferences.controllerDeadzone, 0.04);
  assert.equal(result.capabilities.input.rumble, false);
});
test('session preferences honor a scoped launch controller override without changing workspace defaults', () => {
  const result = createSessionPreferences(
    {},
    undefined,
    { id: 'gaming', quality: 'balanced', controllerProfile: 'Xbox layout', overlay: true },
    [],
    { controllerProfile: 'PlayStation layout' },
  );
  assert.equal(result.preferences.controllerProfile, 'PlayStation layout');
  assert.equal(result.preferences.controllerBindings.confirm, 'button-1');
});
test('session preferences discard a scoped override when its custom profile was removed', () => {
  const result = createSessionPreferences(
    {},
    undefined,
    { id: 'gaming', quality: 'balanced', controllerProfile: 'Xbox layout', overlay: true },
    [],
    { controllerProfile: 'deleted-custom' },
  );
  assert.equal(result.preferences.controllerProfile, 'Xbox layout');
  assert.equal(result.preferences.controllerProfileSelection, 'Xbox layout');
  assert.equal(result.preferences.controllerBindings.confirm, 'button-0');
});
test('session preferences carry the privacy clear-on-exit policy', () => {
  assert.equal(
    createSessionPreferences({ 'privacy.clearOnExit': true }).preferences.clearOnExit,
    true,
  );
  assert.equal(createSessionPreferences().preferences.clearOnExit, false);
});
test('session preferences gate local telemetry collection through privacy settings', () => {
  assert.equal(createSessionPreferences().preferences.sessionTelemetry, true);
  assert.equal(
    createSessionPreferences({ 'privacy.sessionTelemetry': false }).preferences.sessionTelemetry,
    false,
  );
});
test('session preferences gate refresh recovery through general settings', () => {
  assert.equal(createSessionPreferences().preferences.restoreSession, true);
  assert.equal(
    createSessionPreferences({ 'general.restoreSession': false }).preferences.restoreSession,
    false,
  );
});
test('session preferences apply observed display policy evidence without storing capabilities', () => {
  const result = createSessionPreferences(
    { 'media.hdr': true, 'media.refreshRate': '240 Hz', 'streaming.codec': 'Automatic' },
    {
      graphics: { hdr: false },
      display: { maxRefreshRate: 144 },
      media: { codecs: { av1: false, vp9: true, h264: true } },
    },
  );
  assert.equal(result.capabilities.video.hdr, false);
  assert.equal(result.capabilities.video.maxFramerate, 144);
  assert.deepEqual(result.capabilities.video.codecs, ['vp9', 'h264']);
  assert.equal(result.preferences.displayPolicy.maxRefreshRate, 144);
});
test('session preferences apply explicit power mode and injected battery evidence to quality ceilings', () => {
  const saver = createSessionPreferences({
    'streaming.resolution': '4K',
    'streaming.framerate': '144 FPS',
    'streaming.bitrate': 40,
    'performance.powerMode': 'Battery saver',
  });
  assert.deepEqual(saver.preferences.powerPolicy.limits, {
    maxWidth: 1280,
    maxHeight: 720,
    maxFramerate: 30,
    bitrateKbps: 6000,
  });
  assert.equal(
    saver.preferences.qualityProfiles.find((profile) => profile.id === 'ultra').maxWidth,
    1280,
  );
  assert.deepEqual(saver.capabilities.video, {
    codecs: ['av1', 'vp9', 'h264'],
    maxWidth: 1280,
    maxHeight: 720,
    maxFramerate: 30,
    hdr: false,
  });
  const lowBattery = createSessionPreferences(
    { 'streaming.resolution': '4K', 'streaming.bitrate': 40 },
    undefined,
    undefined,
    [],
    { powerState: { batteryPercent: 8 } },
  );
  assert.equal(lowBattery.preferences.powerPolicy.status, 'emergency');
  assert.equal(
    lowBattery.preferences.qualityProfiles.find((profile) => profile.id === 'balanced').maxWidth,
    960,
  );
});
