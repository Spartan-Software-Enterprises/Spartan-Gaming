import { PROFILE_IDS } from '../../src/frontend/profiles/storage.mjs';

const PROFILE_ID_SET = new Set(PROFILE_IDS);

export const SHARED_PROVIDER_PARTITION = 'persist:spartan-gaming-providers';

export function normalizeProviderSessionOptions(options = {}) {
  const profileId = PROFILE_ID_SET.has(options?.profileId) ? options.profileId : 'gaming';
  return Object.freeze({
    profileId,
    isolateAccounts: options?.isolateAccounts !== false,
    autoDetect: options?.autoDetect !== false,
  });
}

export function resolveProviderPartition(options = {}) {
  const normalized = normalizeProviderSessionOptions(options);
  return normalized.isolateAccounts
    ? `persist:spartan-gaming-providers-${normalized.profileId}`
    : SHARED_PROVIDER_PARTITION;
}

/** Every partition owned by Spartan's provider player and therefore eligible for explicit logout. */
export function providerSessionPartitions() {
  return Object.freeze([
    SHARED_PROVIDER_PARTITION,
    ...PROFILE_IDS.map((profileId) => `persist:spartan-gaming-providers-${profileId}`),
  ]);
}
