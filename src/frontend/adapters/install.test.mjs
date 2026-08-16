import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAdapterInstallRequest,
  createAdapterReleaseInstallRequest,
  toAdapterUpdatePlan,
} from './install.mjs';

const available = {
  status: 'update-available',
  id: 'core-1',
  from: '1.0.0',
  to: '1.1.0',
  adapter: {
    id: 'core-1',
    kind: 'emulator-core',
    trust: 'signed',
    platforms: ['linux', 'win32'],
    artifact: { url: 'https://example.invalid/core.tar.zst', sha256: 'abc' },
    integrity: 'sha256:abc',
    signature: 'sig',
    license: 'mit',
  },
  readiness: { status: 'ready' },
};

test('adapter install requires an available update and explicit consent', () => {
  assert.throws(
    () => createAdapterInstallRequest({ updatePlan: { status: 'none' }, consent: true }),
    /available adapter update/,
  );
  assert.throws(
    () => createAdapterInstallRequest({ updatePlan: available, consent: false }),
    /explicit user consent/,
  );
});

test('adapter install requires a verified signed adapter and readiness', () => {
  assert.throws(
    () =>
      createAdapterInstallRequest({
        updatePlan: { ...available, adapter: { trust: 'self' } },
        consent: true,
      }),
    /verified signed adapters/,
  );
  assert.throws(
    () =>
      createAdapterInstallRequest({
        updatePlan: { ...available, readiness: { status: 'failed' } },
        consent: true,
      }),
    /verified signed adapters/,
  );
  assert.throws(
    () =>
      createAdapterInstallRequest({
        updatePlan: { ...available, adapter: { ...available.adapter, artifact: undefined } },
        consent: true,
      }),
    /signed artifact descriptor/,
  );
});

test('adapter install validates the requested platform', () => {
  assert.throws(
    () => createAdapterInstallRequest({ updatePlan: available, consent: true, platform: 'darwin' }),
    /does not support/,
  );
  const universal = createAdapterInstallRequest({
    updatePlan: {
      ...available,
      adapter: { ...available.adapter, platforms: ['universal'] },
    },
    consent: true,
    platform: 'darwin',
  });
  assert.equal(universal.platform, 'darwin');
});

test('adapter install produces a bounded frozen handoff', () => {
  const request = createAdapterInstallRequest({
    updatePlan: available,
    consent: true,
    platform: 'linux',
  });
  assert.equal(request.version, 1);
  assert.equal(request.id, 'core-1');
  assert.equal(request.kind, 'emulator-core');
  assert.equal(request.from, '1.0.0');
  assert.equal(request.to, '1.1.0');
  assert.equal(request.platform, 'linux');
  assert.equal(request.installScope, 'user');
  assert.equal(request.requiresRestart, true);
  assert.deepEqual(request.verification, {
    integrity: 'sha256:abc',
    signature: 'sig',
    license: 'mit',
  });
  assert.ok(Object.isFrozen(request));
  assert.ok(Object.isFrozen(request.verification));
});

test('adapter update plan maps install-available plans to update shape', () => {
  const plan = toAdapterUpdatePlan({
    status: 'install-available',
    candidate: { id: 'core-1', version: '2.0.0' },
    readiness: { status: 'ready' },
  });
  assert.equal(plan.status, 'update-available');
  assert.equal(plan.id, 'core-1');
  assert.equal(plan.from, '2.0.0');
  assert.equal(plan.to, '2.0.0');
  assert.equal(plan.adapter.id, 'core-1');
  assert.equal(plan.readiness.status, 'ready');
  assert.throws(() => toAdapterUpdatePlan(null), /release plan/);
  assert.throws(() => toAdapterUpdatePlan({ status: 'install-available' }), /candidate adapter/);
});

test('adapter release install request builds a consented handoff', () => {
  const request = createAdapterReleaseInstallRequest({
    plan: {
      status: 'install-available',
      candidate: {
        id: 'core-1',
        kind: 'emulator-core',
        version: '2.0.0',
        trust: 'signed',
        platforms: ['universal'],
        artifact: { url: 'https://example.invalid/core.tar.zst', sha256: 'abc' },
        integrity: 'sha256:abc',
        signature: 'sig',
        license: 'mit',
      },
      readiness: { status: 'ready' },
    },
    consent: true,
    platform: 'win32',
  });
  assert.equal(request.from, '2.0.0');
  assert.equal(request.to, '2.0.0');
  assert.equal(request.platform, 'win32');
  assert.throws(
    () => createAdapterReleaseInstallRequest({ plan: { status: 'none' }, consent: true }),
    /available adapter update/,
  );
});
