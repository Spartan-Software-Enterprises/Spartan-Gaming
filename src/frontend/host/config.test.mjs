import assert from 'node:assert/strict';
import test from 'node:test';
import { createHostConfigFromSettings, detectHostPlatform } from './config.mjs';

test('host platform detection prefers Electron platform', () => {
  assert.equal(detectHostPlatform({ electronPlatform: 'win32' }), 'win32');
  assert.equal(detectHostPlatform({ electronPlatform: 'darwin' }), 'darwin');
  assert.equal(detectHostPlatform({ electronPlatform: 'linux' }), 'linux');
});

test('host platform detection falls back to navigator metadata', () => {
  const navigatorRef = { userAgentData: { platform: 'Windows' } };
  assert.equal(detectHostPlatform({ navigatorRef }), 'win32');
  const macUA = { userAgentData: { platform: 'Unknown' }, userAgent: 'Macintosh' };
  assert.equal(detectHostPlatform({ navigatorRef: macUA }), 'darwin');
  const windowsUA = { userAgentData: { platform: 'Unknown' }, userAgent: 'Windows NT' };
  assert.equal(detectHostPlatform({ navigatorRef: windowsUA }), 'win32');
  const unknown = { userAgentData: { platform: 'Unknown' }, userAgent: 'Kiosk OS' };
  assert.equal(detectHostPlatform({ navigatorRef: unknown }), 'linux');
});

test('host config requires a supported platform', () => {
  assert.throws(() => createHostConfigFromSettings({ platform: 'winrt' }), /unsupported/);
});

test('host config maps settings into a bounded portable shape', () => {
  const config = createHostConfigFromSettings({
    platform: 'linux',
    host: { hostId: ' agent-id ', name: ' Living Room ' },
    settings: {
      'host.sessionPort': 9000,
      'host.nativePackage': ' spartan-host ',
      'host.protonEnabled': true,
      'host.protonPath': '/usr/bin/proton',
      'host.protonVersion': '9.0',
      'host.protonCompatDataPath': '/data/compat',
      'host.protonSteamClientPath': '/games/steam',
      'host.protonEnvironment': '{"PROTON_ENABLE_NVAPI":"1"}',
      'host.steamOsEnabled': true,
      'host.steamOsMode': 'Desktop Mode',
      'host.gamescopeEnabled': true,
      'host.steamOsFramerate': '120',
      'host.steamInputMode': 'Official action metadata',
      'host.steamOsLaunchMode': 'Proton',
      'host.steamAppId': '12345',
      'host.captureSource': 'Selected display',
      'host.videoCodec': 'AV1',
      'host.maxResolution': '4K',
      'host.maxFramerate': '120 FPS',
      'host.captureSystemAudio': false,
      'host.captureMicrophone': true,
      'host.audioCodec': 'Opus',
      'host.virtualGamepadInstallRoot': '/opt/gamepad',
      'host.virtualGamepadAdapterId': 'adapter-1',
      'controllers.virtualGamepadBackend': 'Linux uinput',
      'controllers.virtualGamepadPackage': 'linux-uinput',
      'controllers.virtualGamepadDevice': '/dev/uinput',
      'controllers.virtualGamepadDevices': ' /dev/uinput , /dev/uinput ',
      'host.allowInputInjection': false,
      'host.enableNativeMedia': true,
      'host.enableNativeAudio': true,
      'host.audioSource': 'PipeWire',
      'host.audioBackend': 'PipeWire',
      'host.requireExplicitPairing': false,
      'host.wakeOnLan': true,
      'host.logLevel': 'Verbose',
    },
  });
  assert.equal(config.platform, 'linux');
  assert.equal(config.hostId, 'agent-id');
  assert.equal(config.hostName, 'Living Room');
  assert.equal(config.port, 9000);
  assert.equal(config.nativePackage, 'spartan-host');
  assert.equal(config.protonEnabled, true);
  assert.equal(config.protonPath, '/usr/bin/proton');
  assert.equal(config.protonVersion, '9.0');
  assert.equal(config.protonCompatDataPath, '/data/compat');
  assert.equal(config.protonSteamClientPath, '/games/steam');
  assert.deepEqual(config.protonOptions, { PROTON_ENABLE_NVAPI: '1' });
  assert.equal(config.steamOsEnabled, true);
  assert.equal(config.steamOsMode, 'desktop');
  assert.equal(config.gamescopeEnabled, true);
  assert.equal(config.steamOsFramerate, 120);
  assert.equal(config.steamInputMode, 'official-actions');
  assert.equal(config.steamOsLaunchMode, 'proton');
  assert.equal(config.steamAppId, '12345');
  assert.equal(config.captureSource, 'Selected display');
  assert.equal(config.videoCodec, 'AV1');
  assert.equal(config.maxResolution, '4K');
  assert.equal(config.maxFramerate, '120 FPS');
  assert.equal(config.captureSystemAudio, false);
  assert.equal(config.captureMicrophone, true);
  assert.equal(config.audioCodec, 'Opus');
  assert.equal(config.virtualGamepadBackend, 'Linux uinput');
  assert.equal(config.virtualGamepadPackage, 'linux-uinput');
  assert.equal(config.virtualGamepadInstallRoot, '/opt/gamepad');
  assert.equal(config.virtualGamepadAdapterId, 'adapter-1');
  assert.equal(config.virtualGamepadDevice, '/dev/uinput');
  assert.deepEqual(config.virtualGamepadDevices, ['/dev/uinput']);
  assert.equal(config.enableInput, false);
  assert.equal(config.enableNativeMedia, true);
  assert.equal(config.enableNativeAudio, true);
  assert.equal(config.audioSource, 'PipeWire');
  assert.equal(config.audioBackend, 'PipeWire');
  assert.equal(config.requireExplicitPairing, false);
  assert.equal(config.wakeOnLan, true);
  assert.equal(config.logLevel, 'Verbose');
});

test('host config bounds and trims unsafe values', () => {
  const config = createHostConfigFromSettings({
    platform: 'linux',
    settings: {
      'host.sessionPort': -5,
      'host.protonEnvironment': 'not json',
      'host.protonOptions': '["array"]',
      'controllers.virtualGamepadDevices': 'a,b,c,d,e,f,g,h,i,j',
    },
  });
  assert.equal(config.port, 0);
  assert.equal(config.protonOptions, undefined);
  assert.equal(config.virtualGamepadDevices.length, 8);
});

test('host config trims oversized text and skips empty identifiers', () => {
  const config = createHostConfigFromSettings({
    platform: 'win32',
    host: { hostId: ' '.repeat(200) },
    settings: {},
  });
  assert.equal(config.hostId, undefined);
  assert.equal(config.hostName, undefined);
  assert.equal(config.port, 8787);
  assert.equal(config.steamOsLaunchMode, 'native-linux');
  assert.equal(config.steamInputMode, 'fallback');
  assert.equal(config.steamOsFramerate, 60);
});
