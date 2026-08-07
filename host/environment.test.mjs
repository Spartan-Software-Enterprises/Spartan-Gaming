import test from 'node:test';
import assert from 'node:assert/strict';
import {detectHostEnvironment} from './environment.mjs';

test('host environment detection is deterministic with injected probes', () => { const environment = detectHostEnvironment({platformName: 'linux', releaseName: 'test', commandProbe: command => command === 'ffmpeg'}); assert.equal(environment.adapter.id, 'linux-pipewire'); assert.equal(environment.tools.ffmpeg, true); assert.equal(environment.tools.gstreamer, false); assert.equal(environment.readiness.mediaEncode, true); assert.equal(environment.readiness.osInput, false); });
test('unsupported platforms fail closed', () => { const environment = detectHostEnvironment({platformName: 'ios', commandProbe: () => false}); assert.equal(environment.adapter, null); assert.equal(environment.readiness.mediaEncode, false); });
