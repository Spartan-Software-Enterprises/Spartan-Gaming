import {readFileSync} from 'node:fs';
import {createProcessLaunchPlan} from './adapters.mjs';

const MODES = new Set(['desktop', 'game']);
const FRAMERATES = new Set([30, 40, 60]);

function text(value, name, maximum = 1024) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum || /[\u0000\r\n]/.test(value)) throw new TypeError(`${name} must be a bounded single-line string`);
  return value.trim();
}

function localPath(value, name) {
  const result = text(value, name);
  if (/^[a-z]+:\/\//i.test(result) || result.startsWith('\\\\')) throw new TypeError(`${name} must be a local path`);
  return result;
}

function flag(value, name, fallback = false) {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') throw new TypeError(`${name} must be boolean`);
  return value;
}

/** Normalize the explicit SteamOS handheld policy without inferring SteamOS from a browser user-agent. */
export function normalizeSteamOsProfile({platform = 'linux', detected = false, mode = 'game', gamescopeEnabled = false, width = 1280, height = 800, framerate = 60, steamInput = 'fallback'} = {}) {
  if (platform !== 'linux') throw new TypeError('SteamOS profiles require a Linux host');
  if (typeof detected !== 'boolean') throw new TypeError('SteamOS detected flag must be boolean');
  if (!MODES.has(mode)) throw new TypeError('SteamOS mode is unsupported');
  if (!FRAMERATES.has(Number(framerate))) throw new RangeError('SteamOS framerate must be 30, 40, or 60');
  if (Number(width) !== 1280 || Number(height) !== 800) throw new RangeError('SteamOS handheld profile is capped at 1280x800');
  if (!['official-actions', 'fallback'].includes(steamInput)) throw new TypeError('Steam Input mode is unsupported');
  return Object.freeze({platform, detected, mode, gamescopeEnabled: flag(gamescopeEnabled, 'gamescopeEnabled'), width: 1280, height: 800, framerate: Number(framerate), steamInput, controllerOnlyNavigation: true, requiresPhysicalValidation: true});
}

/** Detect only an explicit SteamOS os-release identity; generic Linux remains generic Linux. */
export function detectSteamOs({platform = process.platform, osReleasePath = '/etc/os-release', readFile = readFileSync} = {}) {
  if (platform !== 'linux') return normalizeSteamOsProfile({platform, detected: false});
  let content = '';
  try { content = String(readFile(osReleasePath, 'utf8')); } catch { return normalizeSteamOsProfile({platform, detected: false}); }
  const values = Object.fromEntries(content.split('\n').flatMap(line => { const match = line.match(/^([A-Z_]+)=(.*)$/); return match ? [[match[1], match[2].replace(/^"|"$/g, '')]] : []; }));
  const detected = values.ID === 'steamos' || values.VARIANT_ID === 'steamos';
  return normalizeSteamOsProfile({platform, detected});
}

/** Create a shell-free Gamescope wrapper plan for an explicitly selected game command. */
export function createGamescopeLaunchPlan({profile, gamescopePath, gamePath, gameArgs = [], cwd} = {}) {
  if (!profile?.detected) throw new Error('Gamescope planning requires an explicitly detected SteamOS host');
  if (!profile.gamescopeEnabled) throw new Error('Gamescope is disabled in the SteamOS profile');
  const executable = localPath(gamescopePath, 'gamescopePath');
  const game = localPath(gamePath, 'gamePath');
  if (!Array.isArray(gameArgs) || gameArgs.length > 128 || gameArgs.some(argument => typeof argument !== 'string' || argument.length > 1024 || /[\u0000\r\n]/.test(argument))) throw new TypeError('gameArgs must contain bounded argument strings');
  return Object.freeze({kind: 'gamescope-launch', platform: 'linux', profile, process: createProcessLaunchPlan({executable, args: ['-W', String(profile.width), '-H', String(profile.height), '-r', String(profile.framerate), '-f', '--', game, ...gameArgs], cwd: cwd === undefined ? undefined : localPath(cwd, 'gameCwd')}), requires: Object.freeze(['detected-steamos-host', 'user-selected-gamescope', 'user-selected-game-file', 'native-process-permission'])});
}

export {FRAMERATES as STEAMOS_FRAMERATES, MODES as STEAMOS_MODES};
