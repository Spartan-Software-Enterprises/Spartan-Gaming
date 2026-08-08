import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeBrowserHostConfig} from './browser-studio.mjs';

test('browser host studio normalizes connection and capture fields without persistence', () => { assert.deepEqual(normalizeBrowserHostConfig({endpoint: ' wss://relay.example/signal ', sessionId: ' ses-1 ', ticket: ' ticket ', hostId: '', hostName: '', audio: true, microphone: true, microphoneDeviceId: ' mic-1 ', displaySurface: 'window', framerate: 300}), {endpoint: 'wss://relay.example/signal', sessionId: 'ses-1', ticket: 'ticket', hostId: 'browser-host', hostName: 'Browser Host', audio: true, microphone: true, microphoneDeviceId: 'mic-1', displaySurface: 'window', framerate: 240}); assert.equal(normalizeBrowserHostConfig({displaySurface: 'invalid', framerate: 0}).displaySurface, 'monitor'); assert.equal(normalizeBrowserHostConfig({displaySurface: 'invalid', framerate: 0}).framerate, 60); });
