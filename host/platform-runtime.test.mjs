import assert from 'node:assert/strict';
import test from 'node:test';
import {createPlatformHostRuntime, createPlatformRuntimePlans} from './platform-runtime.mjs';

const environments = {win32: {microphoneGranted: true}, darwin: {microphoneGranted: true, screenRecordingGranted: true}, linux: {DISPLAY: ':0.0', XDG_RUNTIME_DIR: '/run/user/1000'}};
function publisher() { return {capabilities: {state: 'unconfigured'}, async start() {}, async stop() {}}; }

test('platform runtime selects bounded capture and audio plans for every desktop OS', () => { for (const platform of ['win32', 'darwin', 'linux']) { const plans = createPlatformRuntimePlans({platform, environment: environments[platform], includeAudio: true, width: 1280, height: 720, framerate: 60}); assert.equal(plans.capture.platform, platform); assert.equal(plans.audio.platform, platform); assert.equal(plans.encoder.codec, 'h264'); assert.equal(plans.capture.process.shell, false); } });
test('platform runtime chooses Linux X11 fallback only when no session environment exists', () => { const plans = createPlatformRuntimePlans({platform: 'linux', environment: {DISPLAY: ':1.0'}, includeAudio: false}); assert.equal(plans.capture.sourceType, 'x11'); assert.equal(plans.audio, null); assert.equal(plans.audioPublisher, null); });
test('platform host runtime rejects mismatched plans and binds the native session', async () => { const plans = createPlatformRuntimePlans({platform: 'darwin', environment: environments.darwin, includeAudio: false}); assert.throws(() => createPlatformHostRuntime({platform: 'linux', plans, mediaPublisher: publisher()}), /match/); const runtime = createPlatformHostRuntime({platform: 'darwin', plans, mediaPublisher: publisher()}); await runtime.session.start(); assert.equal(runtime.session.state, 'active'); await runtime.session.stop(); });
