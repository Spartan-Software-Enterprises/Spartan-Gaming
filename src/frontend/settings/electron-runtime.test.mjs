import assert from 'node:assert/strict';
import test from 'node:test';
import {
  describeElectronRuntimeResult,
  resolveElectronRuntimeSettings,
} from './electron-runtime.mjs';

test('Electron runtime settings reflect persisted performance and privacy choices', () => {
  assert.deepEqual(
    resolveElectronRuntimeSettings({
      'advanced.developerMode': true,
      'general.backgroundApps': true,
      'general.globalShortcut': 'CommandOrControl+Shift+G',
      'performance.hardwareAcceleration': false,
      'performance.crashReports': true,
      'advanced.verboseLogs': true,
      'advanced.logRetention': '30 days',
      'performance.backgroundThrottling': false,
      'performance.powerMode': 'Performance',
      'privacy.doNotTrack': true,
      'privacy.blockThirdPartyCookies': true,
      'privacy.permissionPrompts': 'Ask every time',
    }),
    {
      developerMode: true,
      hardwareAcceleration: false,
      crashReports: true,
      verboseLogs: true,
      logRetention: '30 days',
      backgroundApps: true,
      globalShortcut: 'CommandOrControl+Shift+G',
      backgroundThrottling: false,
      powerMode: 'Performance',
      doNotTrack: true,
      blockThirdPartyCookies: true,
      permissionPrompts: 'Ask every time',
    },
  );
});

test('Electron runtime settings default safely when values are absent', () => {
  assert.deepEqual(resolveElectronRuntimeSettings({}), {
    developerMode: false,
    hardwareAcceleration: true,
    crashReports: false,
    verboseLogs: false,
    logRetention: undefined,
    backgroundApps: false,
    globalShortcut: undefined,
    backgroundThrottling: true,
    powerMode: undefined,
    doNotTrack: false,
    blockThirdPartyCookies: false,
    permissionPrompts: undefined,
  });
});

test('Electron runtime settings describe global shortcut registration outcomes', () => {
  assert.equal(
    describeElectronRuntimeResult({ startupPolicy: { requiresRestart: true } }),
    'Saved locally; restart Spartan Gaming to apply hardware acceleration changes.',
  );
  assert.equal(
    describeElectronRuntimeResult({
      globalShortcutStatus: { status: 'registered', accelerator: 'CommandOrControl+Shift+G' },
    }),
    'Saved locally; CommandOrControl+Shift+G is active.',
  );
  assert.equal(
    describeElectronRuntimeResult({
      globalShortcutStatus: { status: 'unavailable', accelerator: 'CommandOrControl+Shift+G' },
    }),
    'Saved locally; desktop shortcut is unavailable or already in use.',
  );
  assert.equal(describeElectronRuntimeResult(), 'Saved locally');
});
