import assert from 'node:assert/strict';
import test from 'node:test';
import {createApprovedNetworkPolicy} from './network-policy.mjs';

const policy = createApprovedNetworkPolicy({
  providers: [{id: 'custom-cloud', url: 'https://play.example/game', networkHosts: ['login.identity.example'], nativeApp: {releaseUrl: 'https://downloads.example/app.exe'}}],
  games: [{url: 'https://games.example/play'}],
  downloadSources: ['https://updates.example/releases'],
});

test('standalone network policy permits only cataloged gaming launches', () => {
  assert.equal(policy.allowsProviderLaunch('https://play.example/game'), true);
  assert.equal(policy.allowsProviderLaunch('https://play.example/other'), false);
  assert.equal(policy.allowsProviderLaunch('https://unknown.example/game'), false);
  assert.equal(policy.allowsProviderLaunch('http://play.example/game'), false);
});

test('standalone network policy bounds service navigation and downloads', () => {
  assert.equal(policy.allowsServiceUrl('https://cdn.play.example/assets/game.js'), true);
  assert.equal(policy.allowsServiceUrl('https://login.identity.example/oauth/callback#token'), true);
  assert.equal(policy.allowsServiceUrl('https://unknown.example/'), false);
  assert.equal(policy.allowsExternalUrl('https://downloads.example/app.exe'), true);
  assert.equal(policy.allowsExternalUrl('https://updates.example/releases/v1'), true);
  assert.equal(policy.allowsExternalUrl('https://unapproved.example/download'), false);
  assert.equal(policy.allowsExternalUrl('https://user:pass@updates.example/releases'), false);
});
