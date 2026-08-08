import assert from 'node:assert/strict';
import test from 'node:test';
import {createHostPreflight} from './readiness.mjs';

const ready = {media: {state: 'ready', capture: true, encode: true, audio: true, transports: ['webrtc']}, publisher: {state: 'ready'}, audioPublisher: {state: 'ready'}, input: {gamepad: true}};

test('host preflight reports ready media, publisher, audio, input, and transport', () => { const result = createHostPreflight({capabilities: ready}); assert.equal(result.status, 'ready'); assert.equal(result.transport, 'webrtc'); assert.equal(result.checks.every(check => check.status === 'ready'), true); });
test('host preflight identifies blocking unconfigured media and publisher', () => { const result = createHostPreflight({capabilities: {media: {state: 'not-configured', transports: ['webrtc']}, publisher: {state: 'unconfigured'}, input: {}}}); assert.equal(result.status, 'configuration-required'); assert.deepEqual(result.blocking, ['media-capture', 'media-encode', 'publisher']); assert.equal(result.checks.find(check => check.id === 'audio').status, 'warning'); });
test('host preflight fails closed when transports do not overlap', () => { const result = createHostPreflight({capabilities: {...ready, media: {...ready.media, transports: ['websocket']}}, clientTransports: ['webrtc']}); assert.equal(result.status, 'configuration-required'); assert.ok(result.blocking.includes('transport')); });
test('host preflight explains native binding availability without exposing secrets', () => { const result = createHostPreflight({capabilities: ready, environment: {platform: 'linux', nativeBinding: {status: 'available', packageName: '@spartan-gaming/native-linux', capabilities: {gamepad: true, rumble: true}, reason: 'ignored'}}}); assert.equal(result.nativeBinding.status, 'available'); assert.equal(result.nativeBinding.platform, 'linux'); assert.equal(result.nativeBinding.capabilities.gamepad, true); assert.equal(result.nativeBinding.reason, 'ignored'); });
