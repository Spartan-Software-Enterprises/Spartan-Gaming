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
      'performance.gpuPreference': 'Power saving GPU',
      'performance.processModel': 'Maximum isolation',
      'performance.crashReports': true,
      'advanced.verboseLogs': true,
      'advanced.logRetention': '30 days',
      'performance.backgroundThrottling': false,
      'performance.powerMode': 'Performance',
      'privacy.doNotTrack': true,
      'privacy.blockThirdPartyCookies': true,
      'privacy.permissionPrompts': 'Ask every time',
      'updates.channel': 'Beta',
      'updates.autoUpdate': false,
      'updates.notifyRestart': false,
    }),
    {
      developerMode: true,
      hardwareAcceleration: false,
      gpuPreference: 'Power saving GPU',
      processModel: 'Maximum isolation',
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
      updateChannel: 'Beta',
      autoUpdate: false,
      notifyRestart: false,
    },
  );
});

test('Electron runtime settings default safely when values are absent', () => {
  assert.deepEqual(resolveElectronRuntimeSettings({}), {
    developerMode: false,
    hardwareAcceleration: true,
    gpuPreference: 'Automatic',
    processModel: 'Default',
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
    updateChannel: undefined,
    autoUpdate: true,
    notifyRestart: true,
  });
});

test('Electron update status descriptions are bounded and actionable', async () => {
  const { describeElectronUpdateStatus } = await import('./electron-runtime.mjs');
  assert.equal(
    describeElectronUpdateStatus({ status: 'development-build' }),
    'Update checks run only from a packaged Spartan Gaming application.',
  );
  assert.equal(
    describeElectronUpdateStatus({ status: 'downloading', percent: 42 }),
    'Downloading verified update… 42%',
  );
  assert.equal(
    describeElectronUpdateStatus({ status: 'downloaded', version: '1.2.3' }),
    'Spartan Gaming 1.2.3 is ready to install.',
  );
});

test('Electron runtime settings describe global shortcut registration outcomes', () => {
  assert.equal(
    describeElectronRuntimeResult({ startupPolicy: { requiresRestart: true } }),
    'Saved locally; restart Spartan Gaming to apply performance changes.',
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
