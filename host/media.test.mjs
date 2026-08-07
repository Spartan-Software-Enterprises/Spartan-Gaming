import test from 'node:test';
import assert from 'node:assert/strict';
import {createCapturePlan, createEncoderPlan, listCaptureBackends, validateCapturePermission} from './media.mjs';

test('capture backend matrix is platform-specific and plan-only', () => { assert.deepEqual(listCaptureBackends('linux').map(item => item.sourceType), ['x11', 'pipewire']); assert.equal(listCaptureBackends('darwin')[0].status, 'plan-only'); assert.equal(listCaptureBackends('android').length, 0); });
test('capture plans validate permission context and never use a shell', () => { const plan = createCapturePlan({platform: 'linux', sourceType: 'x11', source: ':0.0', environment: {DISPLAY: ':0'}}); assert.equal(plan.process.shell, false); assert.ok(plan.process.args.includes('x11grab')); assert.throws(() => createCapturePlan({platform: 'linux', sourceType: 'x11', source: ':0.0'}), /DISPLAY/); });
test('capture permission and encoder plans fail closed', () => { assert.equal(validateCapturePermission({platform: 'darwin', sourceType: 'avfoundation'}).allowed, false); const plan = createEncoderPlan({codec: 'vp9', bitrateKbps: 6000, preferHardware: false}); assert.equal(plan.process.args.includes('libvpx-vp9'), true); assert.equal(plan.preference, 'software'); assert.throws(() => createEncoderPlan({codec: 'mpeg2'}), /unsupported/); });
