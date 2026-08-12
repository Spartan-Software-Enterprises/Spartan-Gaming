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
    accountId: 'default',
    isolateAccounts: true,
    autoDetect: true,
    autoLogin: true,
  });
  assert.equal(
    resolveProviderPartition({ profileId: 'family' }),
    'persist:spartan-gaming-providers-family-default',
  );
  assert.equal(
    resolveProviderPartition({ profileId: 'guest', isolateAccounts: true }),
    'persist:spartan-gaming-providers-guest-default',
  );
});

test('provider sessions retain the shared compatibility partition when isolation is disabled', () => {
  assert.equal(
    resolveProviderPartition({ profileId: 'family', isolateAccounts: false }),
    SHARED_PROVIDER_PARTITION,
  );
  assert.deepEqual(
    normalizeProviderSessionOptions({ profileId: '../unsafe', autoDetect: false }),
    {
      profileId: 'gaming',
      accountId: 'default',
      isolateAccounts: true,
      autoDetect: false,
      autoLogin: true,
    },
  );
});

test('provider sessions drop retained sign-ins when automatic login is disabled', () => {
  assert.equal(
    resolveProviderPartition({ profileId: 'family', autoLogin: false }),
    'spartan-gaming-providers-ephemeral-family-default',
  );
  assert.equal(
    resolveProviderPartition({ autoLogin: false, isolateAccounts: false }),
    'spartan-gaming-providers-ephemeral-gaming-default',
  );
  assert.deepEqual(normalizeProviderSessionOptions({ autoLogin: false }), {
    profileId: 'gaming',
    accountId: 'default',
    isolateAccounts: true,
    autoDetect: true,
    autoLogin: false,
  });
  assert.equal(
    resolveProviderPartition({ profileId: 'guest', autoLogin: false }),
    'spartan-gaming-providers-ephemeral-guest-default',
  );
});

test('provider sessions isolate accounts within profiles using accountId', () => {
  assert.equal(
    resolveProviderPartition({ profileId: 'family', accountId: 'personal' }),
    'persist:spartan-gaming-providers-family-personal',
  );
  assert.equal(
    resolveProviderPartition({ profileId: 'family', accountId: 'work' }),
    'persist:spartan-gaming-providers-family-work',
  );
  assert.equal(
    resolveProviderPartition({ profileId: 'family', accountId: 'default' }),
    'persist:spartan-gaming-providers-family-default',
  );
});

test('provider sessions use shared partition for default account when isolation is disabled', () => {
  assert.equal(
    resolveProviderPartition({ isolateAccounts: false, accountId: 'default' }),
    SHARED_PROVIDER_PARTITION,
  );
  assert.equal(
    resolveProviderPartition({ isolateAccounts: false, accountId: 'personal' }),
    `${SHARED_PROVIDER_PARTITION}-personal`,
  );
});

test('provider logout covers the shared partition and every bounded profile partition', () => {
  assert.deepEqual(providerSessionPartitions(), [
    SHARED_PROVIDER_PARTITION,
    ...PROFILE_IDS.map((profileId) => `persist:spartan-gaming-providers-${profileId}`),
  ]);
  assert.equal(new Set(providerSessionPartitions()).size, providerSessionPartitions().length);
});
