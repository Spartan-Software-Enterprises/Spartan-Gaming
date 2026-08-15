import test from 'node:test';
import assert from 'node:assert/strict';
import { createDriverInstallPlan, normalizeDriverDescriptor } from './hardware-drivers.mjs';

const descriptor = (overrides = {}) => ({
  id: 'verified-bluetooth-input',
  version: '1.2.3',
  platform: 'linux',
  installMethod: 'bluetooth-native',
  hardwareIds: ['usb:1234:5678'],
  artifact: {
    url: 'https://vendor.example/driver.tar.zst',
    sizeBytes: 42,
    integrity: 'sha256-abc123',
  },
  signature: { algorithm: 'ed25519', signer: 'vendor-release-key', value: 'signature' },
  rollbackVersion: '1.2.2',
  ...overrides,
});

test('driver descriptors require signed HTTPS artifacts and curated install methods', () => {
  const normalized = normalizeDriverDescriptor(descriptor(), { approvedHosts: ['vendor.example'] });
  assert.equal(normalized.installMethod, 'bluetooth-native');
  assert.deepEqual(normalized.hardwareIds, ['usb:1234:5678']);
  assert.throws(
    () =>
      normalizeDriverDescriptor(
        descriptor({ artifact: { ...descriptor().artifact, url: 'http://vendor.example/driver' } }),
        { approvedHosts: ['vendor.example'] },
      ),
    /HTTPS/,
  );
  assert.throws(
    () =>
      normalizeDriverDescriptor(
        descriptor({
          artifact: { ...descriptor().artifact, url: 'https://untrusted.example/driver' },
        }),
        { approvedHosts: ['vendor.example'] },
      ),
    /allowlist/,
  );
  assert.throws(
    () =>
      normalizeDriverDescriptor(descriptor({ signature: null }), {
        approvedHosts: ['vendor.example'],
      }),
    /signed/,
  );
});

test('driver install plans require exact hardware match and explicit approvals', () => {
  assert.throws(
    () =>
      createDriverInstallPlan({
        descriptor: descriptor(),
        platform: 'linux',
        hardwareId: 'usb:1234:5678',
        approvedHosts: ['vendor.example'],
      }),
    /consent/,
  );
  const plan = createDriverInstallPlan({
    descriptor: descriptor(),
    platform: 'linux',
    hardwareId: 'usb:1234:5678',
    consent: true,
    adminApproved: true,
    approvedHosts: ['vendor.example'],
  });
  assert.equal(plan.status, 'ready');
  assert.equal(plan.requiresRestart, true);
  assert.throws(
    () =>
      createDriverInstallPlan({
        descriptor: descriptor(),
        platform: 'linux',
        hardwareId: 'usb:bad',
        consent: true,
        adminApproved: true,
        approvedHosts: ['vendor.example'],
      }),
    /match/,
  );
});
