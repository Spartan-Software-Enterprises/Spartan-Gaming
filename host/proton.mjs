import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { createProcessLaunchPlan } from './adapters.mjs';

const PATH_ENV = new Set([
  'STEAM_COMPAT_DATA_PATH',
  'STEAM_COMPAT_CLIENT_INSTALL_PATH',
  'PROTON_LOG_DIR',
]);
const BOOLEAN_ENV = new Set([
  'PROTON_LOG',
  'PROTON_USE_WINED3D',
  'PROTON_NO_ESYNC',
  'PROTON_NO_FSYNC',
  'PROTON_NO_NTSYNC',
  'PROTON_DISABLE_NVAPI',
  'PROTON_USE_XALIA',
  'WINE_FULLSCREEN_INTEGER_SCALING',
]);
const LOCALE_ENV = new Set(['HOST_LC_ALL']);

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

function text(value, name, max = 128) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > max ||
    /[\u0000\r\n]/.test(value)
  )
    throw new TypeError(`${name} must be a bounded string`);
  return value.trim();
}

export function normalizeProtonEnvironment({ compatDataPath, steamClientPath, options = {} } = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options))
    throw new TypeError('Proton options must be an object');
  const values = {};
  if (compatDataPath !== undefined)
    values.STEAM_COMPAT_DATA_PATH = localPath(compatDataPath, 'compatDataPath');
  if (steamClientPath !== undefined)
    values.STEAM_COMPAT_CLIENT_INSTALL_PATH = localPath(steamClientPath, 'steamClientPath');
  for (const [key, value] of Object.entries(options)) {
    if (!PATH_ENV.has(key) && !BOOLEAN_ENV.has(key) && !LOCALE_ENV.has(key))
      throw new TypeError(`unsupported Proton environment option: ${key}`);
    if (PATH_ENV.has(key)) values[key] = localPath(value, key);
    else if (BOOLEAN_ENV.has(key)) {
      if (!['0', '1'].includes(String(value))) throw new TypeError(`${key} must be 0 or 1`);
      values[key] = String(value);
    } else values[key] = text(value, key, 64);
  }
  return Object.freeze(values);
}

/** Inspect a user-owned Proton directory without executing or modifying it. */
export function detectProtonRuntime({
  installRoot,
  stat = statSync,
  readFile = readFileSync,
} = {}) {
  const root = localPath(installRoot, 'Proton installRoot');
  const executablePath = path.join(root, 'proton');
  try {
    if (!stat(executablePath).isFile()) throw new Error('not a file');
  } catch {
    throw new Error('Proton executable was not found in the selected install root');
  }
  let version = 'unversioned';
  try {
    version = text(
      String(readFile(path.join(root, 'version'), 'utf8')).trim(),
      'Proton version',
      80,
    );
  } catch {
    /* Some Proton builds omit the version marker. */
  }
  return createProtonRuntimeProfile({
    id: `proton-${
      version
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'local'
    }`,
    protonPath: executablePath,
    version,
  });
}

export function createProtonRuntimeProfile({
  id = 'proton-local',
  protonPath,
  version = 'unversioned',
  compatDataPath,
  steamClientPath,
  options = {},
  trust = 'user-approved',
} = {}) {
  return Object.freeze({
    id: text(id, 'Proton runtime id', 64),
    kind: 'proton',
    version: text(version, 'Proton version', 80),
    trust: text(trust, 'Proton trust', 32),
    enabled: true,
    executablePath: localPath(protonPath, 'protonPath'),
    environment: normalizeProtonEnvironment({ compatDataPath, steamClientPath, options }),
  });
}

/** Create a Linux/SteamOS Proton launch plan; the host still owns execution and consent. */
export function createProtonLaunchPlan({
  platform = 'linux',
  runtimeProfile,
  protonPath,
  version,
  gamePath,
  gameArgs = [],
  cwd,
  compatDataPath,
  steamClientPath,
  options = {},
} = {}) {
  if (platform !== 'linux')
    throw new TypeError('Proton launch plans require a Linux or SteamOS host');
  const profile =
    runtimeProfile ||
    createProtonRuntimeProfile({ protonPath, version, compatDataPath, steamClientPath, options });
  const content = localPath(gamePath, 'gamePath');
  if (profile.kind !== 'proton') throw new TypeError('runtimeProfile must be a Proton profile');
  if (
    !Array.isArray(gameArgs) ||
    gameArgs.length > 128 ||
    gameArgs.some(
      (argument) =>
        typeof argument !== 'string' || argument.length > 1024 || /[\u0000\r\n]/.test(argument),
    )
  )
    throw new TypeError('Proton gameArgs must contain bounded argument strings');
  const process = createProcessLaunchPlan({
    executable: profile.executablePath,
    args: ['run', content, ...gameArgs],
    cwd: cwd === undefined ? path.dirname(content) : localPath(cwd, 'gameCwd'),
    env: profile.environment,
  });
  return Object.freeze({
    kind: 'game-launch',
    platform,
    runtime: Object.freeze({ id: profile.id, kind: 'proton', version: profile.version }),
    gamePath: content,
    process,
    requires: Object.freeze([
      'user-selected-game-file',
      'trusted-proton-installation',
      'native-process-permission',
      'user-owned-proton-prefix',
    ]),
  });
}

export {
  BOOLEAN_ENV as PROTON_BOOLEAN_OPTIONS,
  LOCALE_ENV as PROTON_LOCALE_OPTIONS,
  PATH_ENV as PROTON_PATH_OPTIONS,
};
