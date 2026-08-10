import {createProcessLaunchPlan} from './adapters.mjs';
import {createManagedProcess} from './process.mjs';

const PLATFORMS = new Set(['win32', 'darwin', 'linux', 'android']);
const RUNTIME_KINDS = new Set(['native-adapter', 'native-emulator', 'libretro-core']);

function requiredText(value, name, maximum = 1024) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum || /[\u0000\r\n]/.test(value)) throw new TypeError(`${name} must be a bounded local string`);
  return value.trim();
}

function localPath(value, name) {
  const path = requiredText(value, name);
  if (/^[a-z]+:\/\//i.test(path) || path.startsWith('\\\\')) throw new TypeError(`${name} must be a local path, not a URL or network path`);
  return path;
}

function stringList(value, name) {
  if (!Array.isArray(value) || value.length > 128 || value.some(item => typeof item !== 'string' || item.length > 1024 || /[\u0000\r\n]/.test(item))) throw new TypeError(`${name} must contain bounded argument strings`);
  return Object.freeze(value.map(item => item));
}

/** Create a shell-free, user-owned emulator/game launch plan. */
export function createGameLaunchPlan({platform, runtimeProfile, executablePath = runtimeProfile?.executablePath, gamePath, args = [], cwd, env = {}} = {}) {
  if (!PLATFORMS.has(platform)) throw new TypeError(`unsupported game launch platform: ${platform}`);
  if (!runtimeProfile || !RUNTIME_KINDS.has(runtimeProfile.kind)) throw new TypeError('runtimeProfile must be a trusted native emulator profile');
  if (runtimeProfile.enabled === false || runtimeProfile.trust === 'unverified') throw new Error('runtime profile is not enabled and trusted');
  const executable = localPath(executablePath, 'runtimeProfile.executablePath');
  const content = localPath(gamePath, 'gamePath');
  const launchArgs = stringList(args, 'game launch args');
  const process = createProcessLaunchPlan({executable, args: [...launchArgs, content], cwd: cwd === undefined ? undefined : localPath(cwd, 'game launch cwd'), env});
  return Object.freeze({kind: 'game-launch', platform, runtime: Object.freeze({id: requiredText(runtimeProfile.id, 'runtimeProfile.id', 64), kind: runtimeProfile.kind, version: requiredText(runtimeProfile.version || 'unversioned', 'runtimeProfile.version', 80)}), gamePath: content, process, requires: Object.freeze(['user-selected-game-file', 'trusted-runtime-profile', 'native-process-permission'])});
}

/** Own one launched game process; nothing starts until start() is explicit. */
export function createGameLauncher({plan, spawnImpl, maxOutputBytes, stopTimeoutMs} = {}) {
  if (plan?.kind !== 'game-launch' || plan.process?.shell !== false) throw new TypeError('a game-launch plan is required');
  const managed = createManagedProcess({plan: plan.process, spawnImpl, maxOutputBytes, stopTimeoutMs});
  return Object.freeze({
    get state() { return managed.state; },
    get pid() { return managed.pid; },
    get output() { return managed.output; },
    get plan() { return plan; },
    on: managed.on,
    start: managed.start,
    stop: managed.stop,
  });
}
