import assert from 'node:assert/strict';
import test from 'node:test';
import {createHostDeploymentPlan} from './host-plan.mjs';

test('host deployment plans are cross-platform, shell-free, and explicit about opt-in capabilities', () => {
  const plan = createHostDeploymentPlan({platform: 'windows', nodePath: 'C:/Program Files/nodejs/node.exe', hostRoot: 'C:/Spartan/host', hostId: 'living-room', hostName: 'Living Room', nativePackage: '@spartan-gaming/native-windows', virtualGamepadPackage: '@spartan-gaming/virtual-xinput', virtualGamepadBackend: 'Windows external driver', virtualGamepadDevice: 'xinput-0', enableInput: true, port: 9000});
  assert.equal(plan.platform, 'win32'); assert.equal(plan.args.includes('--enable-input'), true); assert.equal(plan.args.includes('--virtual-gamepad-backend'), true); assert.equal(plan.args.includes('xinput-0'), true); assert.equal(plan.args.includes('--enable-native-media'), false); assert.equal(plan.security.shell, false); assert.equal(plan.security.nativeMediaOptIn, true); assert.equal(plan.persistence.pairing, 'session-only'); assert.equal('signalTicket' in plan, false);
});

test('host deployment plans reject unsafe or incomplete launch settings', () => {
  assert.throws(() => createHostDeploymentPlan({platform: 'android', hostRoot: '/opt/spartan', hostId: 'host'}), /unsupported/); assert.throws(() => createHostDeploymentPlan({platform: 'linux', hostRoot: '/', hostId: 'host'}), /filesystem root/); assert.throws(() => createHostDeploymentPlan({platform: 'linux', hostRoot: '/opt/spartan', hostId: 'host', tlsKey: '/key'}), /provided together/); assert.throws(() => createHostDeploymentPlan({platform: 'linux', hostRoot: '/opt/spartan', hostId: 'host', port: 70000}), /between/);
});
