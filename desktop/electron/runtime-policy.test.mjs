import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyElectronPrivacyHeaders,
  isThirdPartyRequest,
  normalizeElectronRuntimePolicy,
  resolvePermissionDecision,
  shouldQuitWhenWindowsClose,
} from './runtime-policy.mjs';

test('Electron runtime policy defaults to throttling and accepts the explicit performance setting', () => {
  assert.deepEqual(normalizeElectronRuntimePolicy(), {
    developerMode: false,
    backgroundApps: false,
    globalShortcut: null,
    backgroundThrottling: true,
    powerMode: 'Balanced',
    doNotTrack: false,
    blockThirdPartyCookies: false,
    permissionPrompts: 'Ask per site',
    updateChannel: 'Stable',
    autoUpdate: true,
    notifyRestart: true,
  });
  assert.deepEqual(
    normalizeElectronRuntimePolicy({
      developerMode: true,
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
    }),
    {
      developerMode: true,
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
  assert.deepEqual(
    normalizeElectronRuntimePolicy({ backgroundThrottling: false, powerMode: 'Battery saver' }),
    {
      developerMode: false,
      backgroundApps: false,
      globalShortcut: null,
      backgroundThrottling: true,
      powerMode: 'Battery saver',
      doNotTrack: false,
      blockThirdPartyCookies: false,
      permissionPrompts: 'Ask per site',
      updateChannel: 'Stable',
      autoUpdate: true,
      notifyRestart: true,
    },
  );
  assert.deepEqual(
    normalizeElectronRuntimePolicy({
      developerMode: 'true',
      backgroundApps: 'true',
      globalShortcut: 'F1',
      backgroundThrottling: 'false',
      powerMode: 'unsupported',
      doNotTrack: 'true',
      permissionPrompts: 'unsupported',
      updateChannel: 'Nightly',
      autoUpdate: 'false',
      notifyRestart: 'false',
    }),
    {
      developerMode: false,
      backgroundApps: false,
      globalShortcut: null,
      backgroundThrottling: true,
      powerMode: 'Balanced',
      doNotTrack: false,
      blockThirdPartyCookies: false,
      permissionPrompts: 'Ask per site',
      updateChannel: 'Stable',
      autoUpdate: true,
      notifyRestart: true,
    },
  );
});

test('Electron background-app policy preserves platform quit conventions', () => {
  assert.equal(shouldQuitWhenWindowsClose({ platform: 'win32' }), true);
  assert.equal(shouldQuitWhenWindowsClose({ platform: 'win32', backgroundApps: true }), false);
  assert.equal(shouldQuitWhenWindowsClose({ platform: 'linux', backgroundApps: true }), false);
  assert.equal(shouldQuitWhenWindowsClose({ platform: 'darwin' }), false);
});

test('Electron permission policy denies by default and honors per-site decisions', () => {
  assert.equal(
    resolvePermissionDecision(
      normalizeElectronRuntimePolicy({ permissionPrompts: 'Block by default' }),
    ),
    false,
  );
  assert.equal(
    resolvePermissionDecision(
      normalizeElectronRuntimePolicy({ permissionPrompts: 'Ask per site' }),
      { storedDecision: true },
    ),
    true,
  );
  assert.equal(
    resolvePermissionDecision(
      normalizeElectronRuntimePolicy({ permissionPrompts: 'Ask per site' }),
    ),
    null,
  );
  assert.equal(
    resolvePermissionDecision(
      normalizeElectronRuntimePolicy({ permissionPrompts: 'Ask every time' }),
      { storedDecision: true },
    ),
    null,
  );
});

test('Electron privacy headers add DNT and strip cookies only for cross-origin requests', () => {
  assert.equal(
    isThirdPartyRequest({ url: 'https://cdn.example/game.js', initiator: 'http://127.0.0.1:1234' }),
    true,
  );
  assert.equal(
    isThirdPartyRequest({ url: 'https://cdn.example/game.js', initiator: 'https://cdn.example' }),
    false,
  );
  const policy = normalizeElectronRuntimePolicy({ doNotTrack: true, blockThirdPartyCookies: true });
  assert.deepEqual(
    applyElectronPrivacyHeaders(
      { Cookie: 'secret=1', dnt: '0', Accept: '*/*' },
      { url: 'https://cdn.example/game.js', initiator: 'http://127.0.0.1:1234' },
      policy,
    ),
    { Accept: '*/*', DNT: '1' },
  );
  assert.deepEqual(
    applyElectronPrivacyHeaders(
      { Cookie: 'session=1' },
      { url: 'https://cdn.example/game.js', initiator: 'https://cdn.example' },
      policy,
    ),
    { Cookie: 'session=1', DNT: '1' },
  );
});
