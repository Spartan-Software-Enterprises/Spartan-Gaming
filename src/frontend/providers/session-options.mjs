import { PROFILE_IDS } from '../profiles/storage.mjs';

const PROFILE_ID_SET = new Set(PROFILE_IDS);

/** Resolve the bounded provider session options sent to the desktop shell. */
export function resolveProviderSessionOptions(
  settings = {},
  { profileId = 'gaming', accountId = 'default' } = {},
) {
  return Object.freeze({
    profileId: PROFILE_ID_SET.has(profileId) ? profileId : 'gaming',
    accountId: typeof accountId === 'string' && accountId.trim() ? accountId.trim() : 'default',
    isolateAccounts: settings['providers.isolateAccounts'] !== false,
    autoDetect: settings['providers.autoDetect'] !== false,
    autoLogin: settings['providers.autoLogin'] !== false,
  });
}
