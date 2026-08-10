#!/usr/bin/env node
import {constants as fsConstants, promises as fs} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const PLATFORMS = new Set(['win32', 'darwin', 'linux']);
const DEFAULT_ROOTS = Object.freeze({win32: 'SPARTAN_NATIVE_WINDOWS_INSTALL', darwin: 'SPARTAN_NATIVE_MACOS_INSTALL', linux: 'SPARTAN_NATIVE_LINUX_INSTALL'});

function requiredPlatform(value) { const aliases = {windows: 'win32', win: 'win32', macos: 'darwin', mac: 'darwin', osx: 'darwin', linux: 'linux'}; const result = aliases[String(value || '').toLowerCase()] || String(value || '').toLowerCase(); if (!PLATFORMS.has(result)) throw new TypeError(`unsupported desktop platform: ${value}`); return result; }
function text(value) { return typeof value === 'string' ? value.trim() : ''; }
function defaultInstallRoot(platform) { const selectedPlatform = requiredPlatform(platform); return text(process.env[DEFAULT_ROOTS[selectedPlatform]]) || path.resolve(`out/native-${selectedPlatform === 'win32' ? 'windows' : selectedPlatform === 'darwin' ? 'macos' : 'linux'}/install`); }
function modulePath(installRoot) { return pathToFileURL(path.resolve(installRoot, 'index.mjs')).href; }
function boundedDuration(value) { const result = value === undefined ? 250 : Number(value); if (!Number.isInteger(result) || result < 50 || result > 2000) throw new RangeError('durationMs must be between 50 and 2000'); return result; }

async function exerciseBindings(bindings, {durationMs = 250, delay = ms => new Promise(resolve => setTimeout(resolve, ms)), environment = process.env} = {}) {
  const result = {state: 'ready', capture: 'not-run', audio: 'not-run', input: 'not-run', haptics: 'not-run'};
  const active = [];
  try {
    if (typeof bindings.capture?.start !== 'function' || typeof bindings.capture?.stop !== 'function') throw new Error('native capture lifecycle is unavailable');
    await bindings.capture.start({permissionGranted: true, source: environment.SPARTAN_HARDWARE_CAPTURE_SOURCE || undefined}); active.push(bindings.capture); result.capture = 'verified';
    if (typeof bindings.audio?.start !== 'function' || typeof bindings.audio?.stop !== 'function') throw new Error('native audio lifecycle is unavailable');
    await bindings.audio.start({permissionGranted: true, source: environment.SPARTAN_HARDWARE_AUDIO_SOURCE || undefined}); active.push(bindings.audio); result.audio = 'verified';
    if (typeof bindings.input?.execute !== 'function') throw new Error('native input execution is unavailable');
    await bindings.input.execute({kind: 'key', control: 'F20', pressed: true}); await bindings.input.execute({kind: 'key', control: 'F20', pressed: false}); result.input = 'verified';
    if (bindings.capabilities?.rumble !== true) throw new Error('native haptics/rumble capability is unavailable');
    await bindings.input.execute({kind: 'rumble', gamepadIndex: 0, strongMagnitude: 0.25, weakMagnitude: 0.15, durationMs: Math.min(durationMs, 500)}); result.haptics = 'verified';
    await delay(durationMs);
    return Object.freeze(result);
  } catch (error) {
    return Object.freeze({...result, state: 'unavailable', reason: error?.message || 'native hardware exercise failed'});
  } finally {
    for (const controller of active.reverse()) { try { await controller.stop?.(); } catch {} }
  }
}

/** Inspect a native package without injecting input, opening capture, or starting audio. */
export async function verifyDesktopCapabilities({platform = process.platform, installRoot, loadModule = specifier => import(specifier), access = fs.access, environment = process.env, execute = false, durationMs = 250, delay} = {}) {
  const selectedPlatform = requiredPlatform(platform); const root = path.resolve(text(installRoot) || defaultInstallRoot(selectedPlatform));
  const report = {platform: selectedPlatform, installRoot: root, package: {state: 'unavailable'}, capabilities: {input: {state: 'not-checked'}, audio: {state: 'not-checked'}, haptics: {state: 'not-checked'}}, hardware: {state: 'not-checked'}, virtualGamepad: {state: selectedPlatform === 'linux' ? 'not-checked' : 'external-driver-required'}};
  if (selectedPlatform === 'linux') {
    try { await access('/dev/uinput', fsConstants.R_OK | fsConstants.W_OK); report.hardware = {state: 'ready', device: '/dev/uinput'}; }
    catch { report.hardware = {state: 'unavailable', reason: 'readable and writable /dev/uinput is required'}; }
  }
  let bindings;
  try {
    const module = await loadModule(modulePath(root));
    if (typeof module?.createBindings !== 'function') throw new Error('native package does not export createBindings');
    bindings = await module.createBindings({environment});
    const capabilities = bindings?.capabilities || {};
    const methods = {input: typeof bindings?.input?.execute === 'function', capture: typeof bindings?.capture?.start === 'function', audio: typeof bindings?.audio?.start === 'function'};
    report.capabilities = {input: {state: methods.input && capabilities.input !== false ? 'ready' : 'unavailable', reason: methods.input && capabilities.input !== false ? null : 'native input binding is unavailable'}, audio: {state: methods.audio && capabilities.audio !== false ? 'ready' : 'unavailable', reason: methods.audio && capabilities.audio !== false ? null : 'native audio capture binding is unavailable'}, haptics: {state: methods.input && capabilities.rumble === true ? 'ready' : 'unavailable', reason: methods.input && capabilities.rumble === true ? null : 'native haptics/rumble capability is unavailable'}};
    const nativeReady = methods.input && methods.capture && methods.audio;
    report.package = {state: nativeReady ? 'ready' : 'incomplete', capabilities: Object.freeze({...capabilities}), methods: Object.freeze(methods)};
    if (selectedPlatform === 'linux') report.virtualGamepad = {state: capabilities.virtualGamepad && report.hardware.state === 'ready' ? 'ready' : 'unavailable', reason: capabilities.virtualGamepad ? report.hardware.reason || null : 'Linux package does not expose virtual gamepad capability'};
    report.status = nativeReady && (selectedPlatform !== 'linux' || report.hardware.state === 'ready') ? 'ready' : 'unavailable';
    if (execute) { report.execution = await exerciseBindings(bindings, {durationMs: boundedDuration(durationMs), delay, environment}); if (report.execution.state !== 'ready') report.status = 'unavailable'; }
  } catch (error) {
    report.package = {state: 'unavailable', reason: error?.message || 'native package could not be loaded'}; report.status = 'unavailable';
  } finally { await bindings?.close?.(); }
  return Object.freeze(report);
}

function argument(argv, name) { const index = argv.indexOf(name); return index < 0 ? '' : argv[index + 1]; }
async function writeReport(file, report) { if (!text(file)) return; const target = path.resolve(file); if (target === path.parse(target).root) throw new TypeError('report file cannot be the filesystem root'); await fs.writeFile(target, `${JSON.stringify(report, null, 2)}\n`, {encoding: 'utf8', mode: 0o600}); }
if (path.resolve(process.argv[1] || '') === path.resolve(new URL(import.meta.url).pathname)) {
  try {
    const argv = process.argv.slice(2); const platform = requiredPlatform(argument(argv, '--platform') || process.platform); const execute = argv.includes('--execute'); if (execute && !argv.includes('--confirm')) throw new Error('hardware execution requires --confirm'); const report = await verifyDesktopCapabilities({platform, installRoot: argument(argv, '--install-root') || undefined, execute, durationMs: argument(argv, '--duration-ms') || undefined}); await writeReport(argument(argv, '--report-file'), report);
    console.log(JSON.stringify(report, null, 2));
    if (argv.includes('--require-hardware') && report.status !== 'ready') process.exitCode = 2;
    if (argv.includes('--require-virtual-gamepad') && report.virtualGamepad.state !== 'ready') process.exitCode = 3;
    if (argv.includes('--require-input') && report.capabilities.input.state !== 'ready') process.exitCode = 4;
    if (argv.includes('--require-audio') && report.capabilities.audio.state !== 'ready') process.exitCode = 5;
    if (argv.includes('--require-haptics') && report.capabilities.haptics.state !== 'ready') process.exitCode = 6;
    if (argv.includes('--require-execution') && report.execution?.state !== 'ready') process.exitCode = 7;
  } catch (error) { console.error(`native capability verification failed: ${error.message}`); process.exitCode = 1; }
}
