import assert from 'node:assert/strict';
import test from 'node:test';
import {resolveElectronRuntimeSettings} from './electron-runtime.mjs';

test('Electron runtime settings reflect persisted performance and privacy choices', () => {
  assert.deepEqual(resolveElectronRuntimeSettings({
    'general.backgroundApps': true,
    'performance.backgroundThrottling': false,
    'performance.powerMode': 'Performance',
    'privacy.doNotTrack': true,
    'privacy.blockThirdPartyCookies': true,
    'privacy.permissionPrompts': 'Ask every time',
  }), {
    backgroundApps: true,
    backgroundThrottling: false,
    powerMode: 'Performance',
    doNotTrack: true,
    blockThirdPartyCookies: true,
    permissionPrompts: 'Ask every time',
  });
});

test('Electron runtime settings default safely when values are absent', () => {
  assert.deepEqual(resolveElectronRuntimeSettings({}), {backgroundApps: false, backgroundThrottling: true, powerMode: undefined, doNotTrack: false, blockThirdPartyCookies: false, permissionPrompts: undefined});
});
