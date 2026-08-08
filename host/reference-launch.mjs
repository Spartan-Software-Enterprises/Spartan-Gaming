import {createGameLaunchPlan, createGameLauncher} from './game-launcher.mjs';
import {matchesHostLaunchRequest} from './launch-request.mjs';

const ID = /^[A-Za-z0-9._:-]{1,128}$/;
const KINDS = new Set(['native-adapter', 'native-emulator', 'libretro-core']);

function text(value, name, max = 128) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000\r\n]/.test(value)) throw new TypeError(`${name} must be a bounded string`);
  return value.trim();
}

/** Build the optional reference-agent launch authority from host-local flags. */
export function createReferenceGameLaunch({platform, runtimeId, runtimeKind = 'native-emulator', runtimeVersion = 'unversioned', runtimePath, gamePath, hostContentId, args = [], cwd, env = {}, spawnImpl, maxOutputBytes, stopTimeoutMs} = {}) {
  const id = text(runtimeId, 'runtimeId', 64);
  if (!KINDS.has(runtimeKind)) throw new TypeError('runtimeKind is unsupported');
  const contentId = text(hostContentId, 'hostContentId');
  if (!ID.test(contentId)) throw new TypeError('hostContentId contains unsupported characters');
  const runtimeProfile = Object.freeze({id, kind: runtimeKind, version: text(runtimeVersion, 'runtimeVersion', 80), trust: 'user-approved', enabled: true, executablePath: text(runtimePath, 'runtimePath', 1024)});
  const plan = createGameLaunchPlan({platform, runtimeProfile, gamePath: text(gamePath, 'gamePath', 1024), args, cwd, env});
  const launcher = createGameLauncher({plan, spawnImpl, maxOutputBytes, stopTimeoutMs});
  const gameName = plan.gamePath.split(/[\\/]/).pop();
  return Object.freeze({
    launcher,
    descriptor: Object.freeze({runtimeId: id, runtimeKind, hostContentId: contentId, gameName}),
    matches(request) {
      try { return matchesHostLaunchRequest(request, {runtimeId: id, hostContentId: contentId, gameName}); } catch { return false; }
    },
  });
}
