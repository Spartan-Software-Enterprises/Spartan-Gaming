import assert from 'node:assert/strict';
import test from 'node:test';
import {createIceConfiguration, normalizeIceServer, redactIceConfiguration} from './ice.mjs';

test('ICE configuration accepts STUN and secure TURN with session-scoped credentials', () => {
  const configuration = createIceConfiguration({servers: [{urls: 'stun:stun.example.test:3478'}, {urls: ['turns:relay.example.test:443?transport=tcp'], username: 'ephemeral-user', credential: 'ephemeral-secret'}], policy: 'relay'});
  assert.equal(configuration.iceServers.length, 2);
  assert.equal(configuration.iceTransportPolicy, 'relay');
  assert.equal(configuration.iceServers[1].credential, 'ephemeral-secret');
  assert.equal(redactIceConfiguration(configuration).hasEphemeralCredentials, true);
});

test('ICE configuration rejects embedded credentials, insecure remote TURN, and excessive limits', () => {
  assert.throws(() => normalizeIceServer({urls: 'turn://user:pass@relay.example.test'}), /embedded/);
  assert.throws(() => normalizeIceServer({urls: 'turn:relay.example.test:3478'}), /turns/);
  assert.throws(() => createIceConfiguration({servers: Array.from({length: 9}, () => ({urls: 'stun:example.test'}))}), /8/);
  assert.throws(() => createIceConfiguration({iceCandidatePoolSize: 17}), /out of bounds/);
});

test('ICE diagnostics never expose credential values', () => {
  const redacted = redactIceConfiguration({iceServers: [{urls: ['turns:secret.example.test:443'], username: 'user', credential: 'do-not-export'}], iceTransportPolicy: 'all'});
  assert.deepEqual(redacted, {serverCount: 1, urls: ['turns://secret.example.test:443'], iceTransportPolicy: 'all', bundlePolicy: 'max-bundle', hasEphemeralCredentials: true});
  assert.equal(JSON.stringify(redacted).includes('do-not-export'), false);
});
