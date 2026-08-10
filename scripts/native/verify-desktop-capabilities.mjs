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

/** Inspect a native package without injecting input, opening capture, or starting audio. */
export async function verifyDesktopCapabilities({platform = process.platform, installRoot, loadModule = specifier => import(specifier), access = fs.access, environment = process.env} = {}) {
  const selectedPlatform = requiredPlatform(platform); const root = path.resolve(text(installRoot) || defaultInstallRoot(selectedPlatform));
  const report = {platform: selectedPlatform, installRoot: root, package: {state: 'unavailable'}, hardware: {state: 'not-checked'}, virtualGamepad: {state: selectedPlatform === 'linux' ? 'not-checked' : 'external-driver-required'}};
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
    const nativeReady = methods.input && methods.capture && methods.audio;
    report.package = {state: nativeReady ? 'ready' : 'incomplete', capabilities: Object.freeze({...capabilities}), methods: Object.freeze(methods)};
    if (selectedPlatform === 'linux') report.virtualGamepad = {state: capabilities.virtualGamepad && report.hardware.state === 'ready' ? 'ready' : 'unavailable', reason: capabilities.virtualGamepad ? report.hardware.reason || null : 'Linux package does not expose virtual gamepad capability'};
    report.status = nativeReady && (selectedPlatform !== 'linux' || report.hardware.state === 'ready') ? 'ready' : 'unavailable';
  } catch (error) {
    report.package = {state: 'unavailable', reason: error?.message || 'native package could not be loaded'}; report.status = 'unavailable';
  } finally { await bindings?.close?.(); }
  return Object.freeze(report);
}

function argument(argv, name) { const index = argv.indexOf(name); return index < 0 ? '' : argv[index + 1]; }
if (path.resolve(process.argv[1] || '') === path.resolve(new URL(import.meta.url).pathname)) {
  try {
    const argv = process.argv.slice(2); const platform = requiredPlatform(argument(argv, '--platform') || process.platform); const report = await verifyDesktopCapabilities({platform, installRoot: argument(argv, '--install-root') || undefined});
    console.log(JSON.stringify(report, null, 2));
    if (argv.includes('--require-hardware') && report.status !== 'ready') process.exitCode = 2;
    if (argv.includes('--require-virtual-gamepad') && report.virtualGamepad.state !== 'ready') process.exitCode = 3;
  } catch (error) { console.error(`native capability verification failed: ${error.message}`); process.exitCode = 1; }
}
