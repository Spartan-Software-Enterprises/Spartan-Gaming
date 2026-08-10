import {readFileSync} from 'node:fs';
import {createProcessLaunchPlan} from './adapters.mjs';

const MODES = new Set(['desktop', 'game']);
const FRAMERATES = new Set([30, 40, 60]);
const LAUNCH_MODES = new Set(['native-linux', 'proton', 'steam', 'non-steam']);

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
export function normalizeSteamOsProfile({platform = 'linux', detected = false, mode = 'game', gamescopeEnabled = false, width = 1280, height = 800, framerate = 60, steamInput = 'fallback', launchMode = 'native-linux', steamAppId, protonConfigured = false, gamePathSelected = false} = {}) {
  if (platform !== 'linux') throw new TypeError('SteamOS profiles require a Linux host');
  if (typeof detected !== 'boolean') throw new TypeError('SteamOS detected flag must be boolean');
  if (!MODES.has(mode)) throw new TypeError('SteamOS mode is unsupported');
  if (!FRAMERATES.has(Number(framerate))) throw new RangeError('SteamOS framerate must be 30, 40, or 60');
  if (Number(width) !== 1280 || Number(height) !== 800) throw new RangeError('SteamOS handheld profile is capped at 1280x800');
  if (!['official-actions', 'fallback'].includes(steamInput)) throw new TypeError('Steam Input mode is unsupported');
  return Object.freeze({platform, detected, mode, gamescopeEnabled: flag(gamescopeEnabled, 'gamescopeEnabled'), width: 1280, height: 800, framerate: Number(framerate), steamInput, controllerOnlyNavigation: true, launch: createSteamOsLaunchReadiness({mode: launchMode, steamAppId, protonConfigured, gamePathSelected}), requiresPhysicalValidation: true});
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

/** Report what a SteamOS launch choice can prove without touching Steam or starting a game. */
export function createSteamOsLaunchReadiness({mode = 'native-linux', steamAppId, protonConfigured = false, gamePathSelected = false} = {}) {
  if (!LAUNCH_MODES.has(mode)) throw new TypeError('SteamOS launch mode is unsupported');
  const appId = steamAppId === undefined || steamAppId === '' ? null : String(steamAppId).trim();
  if (appId !== null && !/^\d{1,9}$/.test(appId)) throw new TypeError('Steam app ID must be a bounded numeric identifier');
  const requires = [];
  let status = 'configuration-required';
  let reason = 'Select a user-owned game path before launch.';
  if (mode === 'native-linux' && gamePathSelected) { status = 'ready'; reason = 'Native Linux launch is configured for a user-owned game path.'; }
  if (mode === 'proton') { if (!protonConfigured) requires.push('proton-installation'); if (!gamePathSelected) requires.push('user-selected-game-file'); if (!requires.length) { status = 'ready'; reason = 'User-owned Proton launch is configured.'; } else reason = 'A Proton installation and user-selected game path are required.'; }
  if (mode === 'steam') { if (!appId) requires.push('steam-app-id'); status = 'official-handoff-required'; reason = 'Steam-owned launch requires an installed, user-approved Steam bridge; Spartan does not control the Steam client.'; }
  if (mode === 'non-steam') { if (!gamePathSelected) requires.push('user-selected-game-file'); status = 'bridge-required'; reason = 'Non-Steam launch requires an operator-approved native or Proton handoff.'; }
  return Object.freeze({mode, status, reason, steamAppId: appId, requires: Object.freeze(requires), userOwned: mode !== 'steam', physicalValidationRequired: true});
}

export {FRAMERATES as STEAMOS_FRAMERATES, MODES as STEAMOS_MODES, LAUNCH_MODES as STEAMOS_LAUNCH_MODES};
