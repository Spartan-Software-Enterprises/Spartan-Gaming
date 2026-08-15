import assert from 'node:assert/strict';
import test from 'node:test';
import { createHostDeploymentPlan } from './host-plan.mjs';

test('host deployment plans are cross-platform, shell-free, and explicit about opt-in capabilities', () => {
  const plan = createHostDeploymentPlan({
    platform: 'windows',
    nodePath: 'C:/Program Files/nodejs/node.exe',
    hostRoot: 'C:/Spartan/host',
    hostId: 'living-room',
    hostName: 'Living Room',
    configPath: 'C:/Spartan/host.json',
    nativePackage: '@spartan-gaming/native-windows',
    virtualGamepadPackage: '@spartan-gaming/virtual-xinput',
    virtualGamepadInstallRoot: 'C:/Spartan/adapters',
    virtualGamepadAdapterId: 'windows-virtual-gamepad',
    virtualGamepadBackend: 'Windows external driver',
    virtualGamepadDevice: 'xinput-0',
    virtualGamepadDevices: ['xinput-0', 'xinput-1'],
    enableInput: true,
    port: 9000,
  });
  const hasPathSuffix = (suffix) =>
    plan.args.some((value) => value.replaceAll('\\', '/').endsWith(suffix));
  assert.equal(plan.platform, 'win32');
  assert.equal(plan.args.includes('--enable-input'), true);
  assert.equal(plan.args.includes('--config'), true);
  assert.equal(hasPathSuffix('C:/Spartan/host.json'), true);
  assert.equal(plan.args.includes('--virtual-gamepad-backend'), true);
  assert.equal(plan.args.includes('--virtual-gamepad-install-root'), true);
  assert.equal(hasPathSuffix('C:/Spartan/adapters'), true);
  assert.equal(plan.args.includes('--virtual-gamepad-adapter-id'), true);
  assert.equal(plan.args.includes('windows-virtual-gamepad'), true);
  assert.equal(plan.args.includes('xinput-0'), true);
  assert.equal(
    plan.args.some((value) => value.includes('xinput-1')),
    true,
  );
  assert.equal(plan.security.shell, false);
  assert.equal(plan.security.nativeMediaOptIn, true);
  assert.equal(plan.persistence.pairing, 'session-only');
  assert.equal('signalTicket' in plan, false);
});

test('host deployment plans reject unsafe or incomplete launch settings', () => {
  assert.throws(
    () =>
      createHostDeploymentPlan({ platform: 'android', hostRoot: '/opt/spartan', hostId: 'host' }),
    /unsupported/,
  );
  assert.throws(
    () => createHostDeploymentPlan({ platform: 'linux', hostRoot: '/', hostId: 'host' }),
    /filesystem root/,
  );
  assert.throws(
    () =>
      createHostDeploymentPlan({
        platform: 'linux',
        hostRoot: '/opt/spartan',
        hostId: 'host',
        tlsKey: '/key',
      }),
    /provided together/,
  );
  assert.throws(
    () =>
      createHostDeploymentPlan({
        platform: 'linux',
        hostRoot: '/opt/spartan',
        hostId: 'host',
        port: 70000,
      }),
    /between/,
  );
});
