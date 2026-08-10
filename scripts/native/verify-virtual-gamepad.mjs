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

/** Verify an installed signed virtual-gamepad package without sending input. */
export async function verifyInstalledVirtualGamepad({platform: targetPlatform, installRoot, id, publicKeyJwk, fsImpl = fs, loadModule = specifier => import(specifier), verifyManifest} = {}) {
  const selectedPlatform = platform(targetPlatform); const root = path.resolve(required(installRoot, 'installRoot')); const adapterId = required(id, 'adapterId');
  const runtime = createInstalledAdapterRuntime({installRoot: root, id: adapterId, platform: selectedPlatform, expectedKind: 'virtual-gamepad', fsImpl, loadModule, verifyManifest: verifyManifest || createInstalledAdapterManifestVerifier({publicKeyJwk, fsImpl})});
  let loaded;
  try {
    loaded = await runtime.load();
    const adapter = loaded.adapter;
    const report = {status: 'ready', platform: selectedPlatform, installRoot: root, adapterId: loaded.manifest.id, version: loaded.manifest.version, kind: loaded.manifest.kind, entrypoint: loaded.manifest.entrypoint, capabilities: Object.freeze({virtualGamepad: true, execute: typeof adapter.execute === 'function'})};
    await adapter.close?.();
    return Object.freeze(report);
  } catch (error) {
    await loaded?.adapter?.close?.();
    return Object.freeze({status: 'unavailable', platform: selectedPlatform, installRoot: root, adapterId, reason: error?.message || 'virtual-gamepad package verification failed'});
  }
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || '')) {
  try {
    const argv = process.argv.slice(2); if (argv.includes('--help') || argv.includes('-h')) { console.log('Usage: npm run native:verify-virtual-gamepad -- --platform windows|macos|linux --install-root PATH --adapter-id ID [--public-key-file PATH]'); process.exit(0); }
    const publicKeyText = text(process.env.SPARTAN_VIRTUAL_GAMEPAD_PUBLIC_KEY_JWK) || (argument(argv, '--public-key-file') ? await fs.readFile(path.resolve(argument(argv, '--public-key-file')), 'utf8') : '');
    const publicKeyJwk = JSON.parse(required(publicKeyText, 'public key JWK'));
    const report = await verifyInstalledVirtualGamepad({platform: argument(argv, '--platform') || process.platform, installRoot: argument(argv, '--install-root'), id: argument(argv, '--adapter-id'), publicKeyJwk});
    console.log(JSON.stringify(report, null, 2)); if (report.status !== 'ready') process.exitCode = 2;
  } catch (error) { console.error(`virtual-gamepad verification failed: ${error.message}`); process.exitCode = 1; }
}
