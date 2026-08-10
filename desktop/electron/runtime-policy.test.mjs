import assert from 'node:assert/strict';
import test from 'node:test';
import {applyElectronPrivacyHeaders, isThirdPartyRequest, normalizeElectronRuntimePolicy} from './runtime-policy.mjs';

test('Electron runtime policy defaults to throttling and accepts the explicit performance setting', () => {
  assert.deepEqual(normalizeElectronRuntimePolicy(), {backgroundThrottling: true, powerMode: 'Balanced', doNotTrack: false, blockThirdPartyCookies: false});
  assert.deepEqual(normalizeElectronRuntimePolicy({backgroundThrottling: false, powerMode: 'Performance', doNotTrack: true, blockThirdPartyCookies: true}), {backgroundThrottling: false, powerMode: 'Performance', doNotTrack: true, blockThirdPartyCookies: true});
  assert.deepEqual(normalizeElectronRuntimePolicy({backgroundThrottling: false, powerMode: 'Battery saver'}), {backgroundThrottling: true, powerMode: 'Battery saver', doNotTrack: false, blockThirdPartyCookies: false});
  assert.deepEqual(normalizeElectronRuntimePolicy({backgroundThrottling: 'false', powerMode: 'unsupported', doNotTrack: 'true'}), {backgroundThrottling: true, powerMode: 'Balanced', doNotTrack: false, blockThirdPartyCookies: false});
});

test('Electron privacy headers add DNT and strip cookies only for cross-origin requests', () => {
  assert.equal(isThirdPartyRequest({url: 'https://cdn.example/game.js', initiator: 'http://127.0.0.1:1234'}), true);
  assert.equal(isThirdPartyRequest({url: 'https://cdn.example/game.js', initiator: 'https://cdn.example'}), false);
  const policy = normalizeElectronRuntimePolicy({doNotTrack: true, blockThirdPartyCookies: true});
  assert.deepEqual(applyElectronPrivacyHeaders({Cookie: 'secret=1', dnt: '0', Accept: '*/*'}, {url: 'https://cdn.example/game.js', initiator: 'http://127.0.0.1:1234'}, policy), {Accept: '*/*', DNT: '1'});
  assert.deepEqual(applyElectronPrivacyHeaders({Cookie: 'session=1'}, {url: 'https://cdn.example/game.js', initiator: 'https://cdn.example'}, policy), {Cookie: 'session=1', DNT: '1'});
});
