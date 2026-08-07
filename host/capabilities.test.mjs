import test from 'node:test';
import assert from 'node:assert/strict';
import {hostMediaReady, normalizeHostCapabilities} from './capabilities.mjs';

test('host capabilities fail closed to an unconfigured media state', () => { const capabilities = normalizeHostCapabilities({media: {state: 'unknown'}, process: {mode: 'unsafe'}}); assert.equal(capabilities.media.state, 'not-configured'); assert.equal(capabilities.process.mode, 'none'); assert.equal(hostMediaReady(capabilities), false); });
test('host capabilities report ready media and bounded adapter modes', () => { const capabilities = normalizeHostCapabilities({media: {state: 'ready', capture: true, encode: true, audio: true, transports: ['webrtc', 'webrtc']}, process: {mode: 'user-selected', launch: true}, input: {gamepad: true, rumble: true}}); assert.equal(capabilities.media.transports.length, 1); assert.equal(hostMediaReady(capabilities), true); assert.equal(capabilities.process.launch, true); });
