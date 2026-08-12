import { PROFILE_IDS } from '../../src/frontend/profiles/storage.mjs';

const PROFILE_ID_SET = new Set(PROFILE_IDS);

export const SHARED_PROVIDER_PARTITION = 'persist:spartan-gaming-providers';

export function normalizeProviderSessionOptions(options = {}) {
  const profileId = PROFILE_ID_SET.has(options?.profileId) ? options.profileId : 'gaming';
  const accountId =
    typeof options?.accountId === 'string' && options.accountId.trim()
      ? options.accountId.trim()
      : 'default';
  return Object.freeze({
    profileId,
    accountId,
    isolateAccounts: options?.isolateAccounts !== false,
    autoDetect: options?.autoDetect !== false,
    autoLogin: options?.autoLogin !== false,
  });
}

/**
 * A provider session retains sign-ins only when automatic login is enabled.
 * Disabling it uses an in-memory partition (no `persist:` prefix) so the
 * service asks to sign in on every launch and nothing survives an app exit.
 * Each account within a provider gets its own isolated partition.
 */
export function resolveProviderPartition(options = {}) {
  const normalized = normalizeProviderSessionOptions(options);
  if (normalized.autoLogin !== true)
    return `spartan-gaming-providers-ephemeral-${normalized.profileId}-${normalized.accountId}`;
  if (normalized.isolateAccounts)
    return `persist:spartan-gaming-providers-${normalized.profileId}-${normalized.accountId}`;
  return normalized.accountId === 'default'
    ? SHARED_PROVIDER_PARTITION
    : `${SHARED_PROVIDER_PARTITION}-${normalized.accountId}`;
}

/** Every partition owned by Spartan's provider player and therefore eligible for explicit logout. */
export function providerSessionPartitions() {
  return Object.freeze([
    SHARED_PROVIDER_PARTITION,
    ...PROFILE_IDS.map((profileId) => `persist:spartan-gaming-providers-${profileId}`),
  ]);
}
