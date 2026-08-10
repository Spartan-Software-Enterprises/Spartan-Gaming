#!/usr/bin/env node
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createInstalledAdapterManifestVerifier, createInstalledAdapterRuntime} from '../../host/adapter-runtime.mjs';

const PLATFORMS = Object.freeze({windows: 'win32', win: 'win32', win32: 'win32', macos: 'darwin', mac: 'darwin', osx: 'darwin', darwin: 'darwin', linux: 'linux'});
function text(value) { return typeof value === 'string' ? value.trim() : ''; }
function required(value, name) { const result = text(value); if (!result) throw new TypeError(`${name} is required`); return result; }
function platform(value) { const result = PLATFORMS[text(value).toLowerCase()]; if (!result) throw new TypeError(`unsupported virtual-gamepad platform: ${value}`); return result; }
function argument(argv, name) { const index = argv.indexOf(name); return index < 0 ? '' : argv[index + 1]; }
async function writeReport(file, report) { if (!text(file)) return; const target = path.resolve(file); if (target === path.parse(target).root) throw new TypeError('report file cannot be the filesystem root'); await fs.writeFile(target, `${JSON.stringify(report, null, 2)}\n`, {encoding: 'utf8', mode: 0o600}); }

/** Verify an installed signed virtual-gamepad package; exercise is opt-in and bounded. */
export async function verifyInstalledVirtualGamepad({platform: targetPlatform, installRoot, id, publicKeyJwk, fsImpl = fs, loadModule = specifier => import(specifier), verifyManifest, execute = false} = {}) {
  const selectedPlatform = platform(targetPlatform); const root = path.resolve(required(installRoot, 'installRoot')); const adapterId = required(id, 'adapterId');
  const runtime = createInstalledAdapterRuntime({installRoot: root, id: adapterId, platform: selectedPlatform, expectedKind: 'virtual-gamepad', fsImpl, loadModule, verifyManifest: verifyManifest || createInstalledAdapterManifestVerifier({publicKeyJwk, fsImpl})});
  let loaded;
  try {
    loaded = await runtime.load();
    const adapter = loaded.adapter;
    const report = {kind: 'virtual-gamepad-exercise', verification: execute ? 'signed-runtime-exercise' : 'signed-runtime-observation', status: 'ready', platform: selectedPlatform, installRoot: root, adapterId: loaded.manifest.id, version: loaded.manifest.version, adapterKind: loaded.manifest.kind, entrypoint: loaded.manifest.entrypoint, capabilities: Object.freeze({virtualGamepad: true, execute: typeof adapter.execute === 'function'})};
    if (execute) {
      if (typeof adapter.execute !== 'function') throw new Error('virtual-gamepad adapter does not provide execute()');
      await adapter.execute({kind: 'button', control: 'button-0', pressed: true});
      await adapter.execute({kind: 'button', control: 'button-0', pressed: false});
      await adapter.execute({kind: 'axis', control: 'axis-0', value: 0});
      report.exercise = Object.freeze({state: 'verified', operations: 3});
    }
    return Object.freeze(report);
  } catch (error) {
    return Object.freeze({kind: 'virtual-gamepad-exercise', verification: execute ? 'signed-runtime-exercise' : 'signed-runtime-observation', status: 'unavailable', platform: selectedPlatform, installRoot: root, adapterId, reason: error?.message || 'virtual-gamepad package verification failed', ...(execute ? {exercise: Object.freeze({state: 'unavailable'})} : {})});
  } finally { await loaded?.adapter?.close?.();
  }
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || '')) {
  try {
    const argv = process.argv.slice(2); if (argv.includes('--help') || argv.includes('-h')) { console.log('Usage: npm run native:verify-virtual-gamepad -- --platform windows|macos|linux --install-root PATH --adapter-id ID [--public-key-file PATH]'); process.exit(0); }
    const publicKeyText = text(process.env.SPARTAN_VIRTUAL_GAMEPAD_PUBLIC_KEY_JWK) || (argument(argv, '--public-key-file') ? await fs.readFile(path.resolve(argument(argv, '--public-key-file')), 'utf8') : '');
    const publicKeyJwk = JSON.parse(required(publicKeyText, 'public key JWK')); const execute = argv.includes('--execute'); if (execute && !argv.includes('--confirm')) throw new Error('virtual-gamepad execution requires --confirm');
    const report = await verifyInstalledVirtualGamepad({platform: argument(argv, '--platform') || process.platform, installRoot: argument(argv, '--install-root'), id: argument(argv, '--adapter-id'), publicKeyJwk, execute}); await writeReport(argument(argv, '--report-file'), report);
    console.log(JSON.stringify(report, null, 2)); if (report.status !== 'ready') process.exitCode = 2; if (argv.includes('--require-execution') && report.exercise?.state !== 'verified') process.exitCode = 3;
  } catch (error) { console.error(`virtual-gamepad verification failed: ${error.message}`); process.exitCode = 1; }
}
