import test from 'node:test';
import assert from 'node:assert/strict';
import {createHostConnectionProfile, createPairingRequest, parseHostEndpoint, selectHostTransport} from './host.mjs';

test('host endpoints reject credentials and insecure remote URLs', () => { assert.throws(() => parseHostEndpoint('https://user:pass@example.test'), /credentials/); assert.throws(() => parseHostEndpoint('http://example.test'), /TLS/); assert.equal(parseHostEndpoint('http://localhost:8787').local, true); });
test('transport selection prefers WebRTC among shared transports', () => { assert.equal(selectHostTransport({clientTransports: ['websocket', 'webrtc'], hostTransports: ['webrtc', 'websocket'], endpoint: 'wss://host.example/session'}), 'webrtc'); assert.throws(() => selectHostTransport({clientTransports: ['webtransport'], hostTransports: ['webtransport'], endpoint: 'http://example.test'}), /TLS/); });
test('pairing requests normalize safe pairing codes and expiry', () => { const request = createPairingRequest({hostId: 'host-1', pairingCode: 'ab-cd23', expiresAt: '2026-08-07T12:00:00Z'}); assert.equal(request.pairingCode, 'ABCD23'); assert.equal(request.type, 'host.pair'); });
test('host connection profile keeps credentials session-scoped', () => { const profile = createHostConnectionProfile({hostId: 'host-1', endpoint: 'wss://host.example/session', hostTransports: ['websocket'], pairingCode: 'ABCD23'}); assert.equal(profile.transport, 'websocket'); assert.equal(profile.credentials, 'session-scoped'); assert.equal(profile.pairing.hostId, 'host-1'); });
