import assert from 'node:assert/strict';
import test from 'node:test';
import {createProviderDetailsModel} from './details.mjs';

const entry = {id: 'twitch', name: 'Twitch', kind: 'live-streaming', backendType: 'provider', supportLevel: 'C', url: 'https://www.twitch.tv/', requirements: ['account'], capabilities: ['video', 'chat']};

test('provider details preserve bounded launch evidence without secrets', () => {
  const model = createProviderDetailsModel(entry, {backendId: 'twitch', status: 'ready', mode: 'official-embed', action: 'embed-url', url: 'https://player.twitch.tv/?channel=spartan', requirements: ['account'], capabilities: ['video', 'chat'], integration: {surfaces: ['video', 'chat'], quality: 'prefer-quality', regionLabel: 'North America', controllerProfile: null, notes: ['Official surface only']}, readiness: {status: 'ready', reason: 'Browser path available', missingCapabilities: [], blocking: [], issues: [{message: 'No credentials are stored'}]}});
  assert.deepEqual(model.surfaces, ['video', 'chat']);
  assert.equal(model.readinessStatus, 'ready');
  assert.equal(model.url, 'https://player.twitch.tv/?channel=spartan');
  assert.equal(Object.hasOwn(model, 'token'), false);
  assert.ok(model.streamPresets.length >= 5);
  assert.ok(model.bandwidthEstimate.totalGb > 0);
  assert.equal(typeof model.deepLinkSupported, 'boolean');
});

test('provider details reject mismatched plans', () => {
  assert.throws(() => createProviderDetailsModel(entry, {backendId: 'youtube-live'}), /matching/);
});
