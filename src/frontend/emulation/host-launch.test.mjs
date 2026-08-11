import assert from 'node:assert/strict';
import test from 'node:test';
import { createNativeHostLaunchRequest } from './host-launch.mjs';

const profile = {
  id: 'dolphin-linux',
  kind: 'native-emulator',
  version: '5.0',
  trust: 'signed',
  enabled: true,
};
const plan = {
  status: 'ready',
  coreId: 'dolphin',
  files: [
    { kind: 'game', name: 'game.iso', size: 123, userSelected: true },
    { kind: 'firmware', name: 'keys.bin', size: 8, userSelected: true, sha256: 'a'.repeat(64) },
  ],
  integration: { runtime: 'native-emulator', runtimeProfile: profile },
};

test('native host launch requests carry consented metadata but never browser paths or bytes', () => {
  const request = createNativeHostLaunchRequest({
    plan,
    hostContentId: 'library-entry-01',
    consent: true,
    clock: () => '2026-08-08T00:00:00.000Z',
  });
  assert.deepEqual(request, {
    version: 1,
    kind: 'emulator',
    coreId: 'dolphin',
    runtime: { id: 'dolphin-linux', kind: 'native-emulator', version: '5.0' },
    hostContentId: 'library-entry-01',
    content: {
      game: { name: 'game.iso', size: 123 },
      firmware: [{ name: 'keys.bin', size: 8, sha256: 'a'.repeat(64) }],
    },
    consent: { approved: true, at: '2026-08-08T00:00:00.000Z' },
  });
  assert.equal(JSON.stringify(request).includes('source'), false);
  assert.equal(JSON.stringify(request).includes('executablePath'), false);
});

test('native host launch requests require matching trusted runtime and explicit consent', () => {
  assert.throws(
    () => createNativeHostLaunchRequest({ plan, hostContentId: 'library-entry-01' }),
    /consent/,
  );
  assert.throws(
    () =>
      createNativeHostLaunchRequest({
        plan,
        runtimeProfile: { ...profile, trust: 'unverified' },
        hostContentId: 'library-entry-01',
        consent: true,
      }),
    /trusted/,
  );
  assert.throws(
    () => createNativeHostLaunchRequest({ plan, hostContentId: 'bad id', consent: true }),
    /hostContentId/,
  );
});
