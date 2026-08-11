import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeProviderSessionOptions,
  providerSessionPartitions,
  resolveProviderPartition,
  SHARED_PROVIDER_PARTITION,
} from './provider-session.mjs';
import { PROFILE_IDS } from '../../src/frontend/profiles/storage.mjs';

test('provider sessions isolate supported local profiles by default', () => {
  assert.deepEqual(normalizeProviderSessionOptions({ profileId: 'family' }), {
    profileId: 'family',
    isolateAccounts: true,
  });
  assert.equal(
    resolveProviderPartition({ profileId: 'family' }),
    'persist:spartan-gaming-providers-family',
  );
  assert.equal(
    resolveProviderPartition({ profileId: 'guest', isolateAccounts: true }),
    'persist:spartan-gaming-providers-guest',
  );
});

test('provider sessions retain the shared compatibility partition when isolation is disabled', () => {
  assert.equal(
    resolveProviderPartition({ profileId: 'family', isolateAccounts: false }),
    SHARED_PROVIDER_PARTITION,
  );
  assert.deepEqual(normalizeProviderSessionOptions({ profileId: '../unsafe' }), {
    profileId: 'gaming',
    isolateAccounts: true,
  });
});

test('provider logout covers the shared partition and every bounded profile partition', () => {
  assert.deepEqual(providerSessionPartitions(), [
    SHARED_PROVIDER_PARTITION,
    ...PROFILE_IDS.map((profileId) => `persist:spartan-gaming-providers-${profileId}`),
  ]);
  assert.equal(new Set(providerSessionPartitions()).size, providerSessionPartitions().length);
});
