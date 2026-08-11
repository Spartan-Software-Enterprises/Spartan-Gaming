import { createProcessLaunchPlan } from './adapters.mjs';

const APP_ID = /^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+$/;
const COMMIT = /^[a-f0-9]{8,64}$/i;
const REGISTRATION_MODES = new Set(['desktop-entry', 'steam-non-steam']);

function localPath(value, name) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > 2048 ||
    /[\u0000\r\n]/.test(value) ||
    /^[a-z]+:\/\//i.test(value) ||
    value.startsWith('\\\\')
  )
    throw new TypeError(`${name} must be a bounded local path`);
  return value.trim();
}

function appId(value) {
  if (typeof value !== 'string' || !APP_ID.test(value.trim()) || value.length > 160)
    throw new TypeError('SteamOS Flatpak app ID must be a reverse-DNS identifier');
  return value.trim();
}

function consent(value) {
  if (value !== true) throw new Error('SteamOS packaging plans require explicit operator consent');
}

function process({ args, cwd }) {
  return createProcessLaunchPlan({ executable: 'flatpak', args, cwd });
}

/** Describe the immutable/user-scope filesystem contract without touching Flatpak. */
export function normalizeSteamOsPackagingProfile({
  appId: value = 'com.spartan.gaming',
  installScope = 'user',
  dataRoot = '~/.var/app',
  configRoot = '~/.config/spartan-gaming',
  cacheRoot = '~/.cache/spartan-gaming',
} = {}) {
  const id = appId(value);
  if (installScope !== 'user')
    throw new TypeError('SteamOS packaging requires the user installation scope');
  for (const [name, path] of Object.entries({ dataRoot, configRoot, cacheRoot }))
    localPath(path, name);
  return Object.freeze({
    appId: id,
    installScope,
    dataRoot: `${dataRoot}/${id}`,
    configRoot,
    cacheRoot,
    immutableHostSafe: true,
    requires: Object.freeze(['user-scope-flatpak', 'operator-consent', 'verified-signed-artifact']),
  });
}

/** Create a consent-gated Flatpak bundle install plan; this function never executes it. */
export function createSteamOsInstallPlan({
  profile,
  artifactPath,
  artifactSha256,
  consentGiven = false,
} = {}) {
  if (!profile?.immutableHostSafe || profile.installScope !== 'user')
    throw new TypeError('a normalized user-scope SteamOS packaging profile is required');
  consent(consentGiven);
  const artifact = localPath(artifactPath, 'artifactPath');
  if (typeof artifactSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(artifactSha256))
    throw new TypeError('artifactSha256 must be a SHA-256 digest');
  return Object.freeze({
    kind: 'steamos-flatpak-install',
    profile,
    artifactSha256: artifactSha256.toLowerCase(),
    process: process({ args: ['--user', 'install', '--bundle', artifact] }),
    requires: Object.freeze([
      'detected-steamos-host',
      'user-scope-flatpak',
      'operator-consent',
      'verified-signed-artifact',
    ]),
    execution: 'operator-run-only',
  });
}

/** Create a user-scope update plan pinned to a verified commit when supplied. */
export function createSteamOsUpdatePlan({ profile, commit, consentGiven = false } = {}) {
  if (!profile?.immutableHostSafe || profile.installScope !== 'user')
    throw new TypeError('a normalized user-scope SteamOS packaging profile is required');
  consent(consentGiven);
  const args = ['--user', 'update'];
  if (commit !== undefined) {
    if (typeof commit !== 'string' || !COMMIT.test(commit))
      throw new TypeError('Flatpak rollback commit must be a bounded hexadecimal ID');
    args.push(`--commit=${commit.toLowerCase()}`);
  }
  args.push(profile.appId);
  return Object.freeze({
    kind: commit === undefined ? 'steamos-flatpak-update' : 'steamos-flatpak-rollback',
    profile,
    commit: commit === undefined ? null : commit.toLowerCase(),
    process: process({ args }),
    requires: Object.freeze([
      'detected-steamos-host',
      'user-scope-flatpak',
      'operator-consent',
      ...(commit === undefined ? [] : ['verified-rollback-commit']),
    ]),
    execution: 'operator-run-only',
  });
}

export function createSteamOsUninstallPlan({
  profile,
  consentGiven = false,
  deleteData = false,
} = {}) {
  if (!profile?.immutableHostSafe || profile.installScope !== 'user')
    throw new TypeError('a normalized user-scope SteamOS packaging profile is required');
  consent(consentGiven);
  return Object.freeze({
    kind: 'steamos-flatpak-uninstall',
    profile,
    process: process({
      args: ['--user', 'uninstall', ...(deleteData ? ['--delete-data'] : []), profile.appId],
    }),
    requires: Object.freeze(['detected-steamos-host', 'user-scope-flatpak', 'operator-consent']),
    execution: 'operator-run-only',
  });
}

/** Describe desktop and Steam non-Steam registration without modifying the host or Steam client. */
export function createSteamOsLaunchRegistrationPlan({
  profile,
  mode = 'desktop-entry',
  consentGiven = false,
  arguments: launchArguments = [],
} = {}) {
  if (!profile?.immutableHostSafe || profile.installScope !== 'user')
    throw new TypeError('a normalized user-scope SteamOS packaging profile is required');
  consent(consentGiven);
  if (!REGISTRATION_MODES.has(mode))
    throw new TypeError('SteamOS launch registration mode is unsupported');
  if (
    !Array.isArray(launchArguments) ||
    launchArguments.length > 16 ||
    launchArguments.some(
      (value) => typeof value !== 'string' || value.length > 256 || /[\u0000\r\n]/.test(value),
    )
  )
    throw new TypeError('launch registration arguments must be bounded strings');
  const exec = ['flatpak', 'run', profile.appId, ...launchArguments].join(' ');
  return Object.freeze({
    kind: 'steamos-launch-registration',
    profile,
    mode,
    desktopEntry: Object.freeze({
      Name: 'Spartan Gaming',
      Type: 'Application',
      Exec: exec,
      Terminal: false,
    }),
    steamNonSteamHandoff: mode === 'steam-non-steam',
    requires: Object.freeze([
      'installed-user-scope-flatpak',
      'operator-consent',
      ...(mode === 'steam-non-steam' ? ['operator-steam-non-steam-registration'] : []),
    ]),
    execution: 'operator-run-only',
  });
}

export { REGISTRATION_MODES as STEAMOS_REGISTRATION_MODES };
