import {readFile, readdir, mkdir} from 'node:fs/promises';
import {basename, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createNativeAdapterInstaller} from '../../host/adapter-installer.mjs';
import {normalizeAdapterPackageManifest} from '../../host/adapter-package.mjs';
import {verifyPackageManifestSignature} from '../../host/package-signing.mjs';
import {createReleaseFeedPlanner, createReleaseInstallRequest, verifyReleaseFeed} from '../../host/release-feed.mjs';

const PLATFORM_ALIASES = Object.freeze({darwin: 'darwin', mac: 'darwin', macos: 'darwin', win: 'win32', windows: 'win32', win32: 'win32', linux: 'linux'});

export function parseUpdateArgs(argv = process.argv.slice(2)) {
  const options = {feed: null, key: null, installRoot: null, platform: process.platform, apply: false};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--feed') options.feed = argv[++index];
    else if (flag === '--key') options.key = argv[++index];
    else if (flag === '--install-root') options.installRoot = argv[++index];
    else if (flag === '--platform') options.platform = PLATFORM_ALIASES[argv[++index]] || process.platform;
    else if (flag === '--apply') options.apply = true;
    else if (flag === '--help') options.help = true;
    else throw new TypeError(`unknown emulator update flag: ${flag}`);
  }
  if (!options.feed || !options.key || !options.installRoot) throw new TypeError('--feed, --key, and --install-root are required');
  return options;
}

async function loadSource(source) {
  if (/^https:\/\//i.test(source)) {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`release feed download failed: ${response.status}`);
    return JSON.parse(await response.text());
  }
  return JSON.parse(await readFile(resolve(source), 'utf8'));
}

async function loadKey(path) { return JSON.parse(await readFile(resolve(path), 'utf8')); }

async function readInstalledRecords(installRoot, platform) {
  const root = resolve(installRoot);
  const records = [];
  let entries = [];
  try { entries = await readdir(root, {withFileTypes: true}); } catch { return records; }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const currentPath = `${root}/${entry.name}/current.json`;
    let pointer; try { pointer = JSON.parse(await readFile(currentPath, 'utf8')); } catch { continue; }
    const manifestPath = `${root}/${entry.name}/${pointer.version}/manifest.json`;
    let manifest; try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')); } catch { continue; }
    records.push({id: pointer.id, version: pointer.version, kind: 'emulator', status: 'installed', trust: 'signed', platforms: [manifest.platform === 'universal' ? platform : manifest.platform], capabilities: ['video', 'audio'], license: 'project-provided', integrity: pointer.integrity || `sha256-${manifest.id}`, signature: manifest.signature, package: manifest});
  }
  return records;
}

/** Fetch a verified release feed, plan installs/updates, and optionally apply them. */
export async function runEmulatorUpdate({feedSource, keyPath, installRoot, platform = process.platform, apply = false, download = async url => { const response = await fetch(url); if (!response.ok) throw new Error(`adapter download failed: ${response.status}`); return response; }, publicKeyJwk = null, feed = null} = {}) {
  if (!platform || !['win32', 'darwin', 'linux'].includes(platform)) throw new TypeError(`unsupported emulator update platform: ${platform}`);
  const trustedKey = publicKeyJwk || await loadKey(keyPath);
  const resolvedFeed = feed || await loadSource(feedSource);
  if (!await verifyReleaseFeed({feed: resolvedFeed, publicKeyJwk: trustedKey})) throw new Error('release feed signature verification failed');
  const installed = await readInstalledRecords(installRoot, platform);
  const planner = createReleaseFeedPlanner({feed: resolvedFeed, platform, kind: 'emulator', installed});
  const installs = planner.plans.filter(plan => plan.status === 'install-available' || plan.status === 'update-available');
  const results = [];
  if (apply && installs.length) {
    await mkdir(installRoot, {recursive: true});
    const verifier = async args => { const source = args.manifest || args.request?.package; if (!source) throw new Error('packaged emulator release is required'); const manifest = normalizeAdapterPackageManifest(source); return verifyPackageManifestSignature({manifest, publicKeyJwk: trustedKey}); };
    const installer = createNativeAdapterInstaller({installRoot, download, verifySignature: verifier, verifyPackageManifest: verifier});
    for (const plan of installs) {
      const request = createReleaseInstallRequest({plan, platform, consent: true});
      results.push(await installer.install(request));
    }
  }
  return Object.freeze({platform, verified: true, plans: planner.plans, installs: Object.freeze(installs), applied: Object.freeze(results)});
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseUpdateArgs(argv);
  if (options.help) { console.log('Usage: node scripts/emulators/update.mjs --feed <url|path> --key <public-jwk.json> --install-root <path> [--platform linux|win32|darwin] [--apply]'); return; }
  const summary = await runEmulatorUpdate({feedSource: options.feed, keyPath: options.key, installRoot: options.installRoot, platform: options.platform, apply: options.apply});
  console.log(JSON.stringify(summary, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
