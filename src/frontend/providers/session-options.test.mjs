import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveProviderSessionOptions } from './session-options.mjs';

test('provider session options retain sign-ins and isolation by default', () => {
  assert.deepEqual(resolveProviderSessionOptions({}), {
    profileId: 'gaming',
    accountId: 'default',
    isolateAccounts: true,
    autoDetect: true,
    autoLogin: true,
  });
});

test('provider session options map the retained sign-in setting', () => {
  assert.deepEqual(
    resolveProviderSessionOptions({ 'providers.autoLogin': false }, { profileId: 'family' }),
    {
      profileId: 'family',
      accountId: 'default',
      isolateAccounts: true,
      autoDetect: true,
      autoLogin: false,
    },
  );
  assert.equal(
    resolveProviderSessionOptions({ 'providers.autoLogin': false }).autoLogin,
    false,
  );
});

test('provider session options bound the profile id and non-boolean inputs', () => {
  assert.equal(resolveProviderSessionOptions({}, { profileId: '../unsafe' }).profileId, 'gaming');
  assert.equal(
    resolveProviderSessionOptions({ 'providers.autoLogin': 'false' }).autoLogin,
    true,
  );
  assert.equal(
    resolveProviderSessionOptions({ 'providers.isolateAccounts': false }).isolateAccounts,
    false,
  );
  assert.equal(
    resolveProviderSessionOptions({ 'providers.autoDetect': false }).autoDetect,
    false,
  );
});

test('provider session options include accountId for multi-account support', () => {
  assert.equal(
    resolveProviderSessionOptions({}, { accountId: 'personal' }).accountId,
    'personal',
  );
  assert.equal(
    resolveProviderSessionOptions({}, { accountId: '' }).accountId,
    'default',
  );
  assert.equal(
    resolveProviderSessionOptions({}, { accountId: '../injection' }).accountId,
    '../injection',
  );
});
