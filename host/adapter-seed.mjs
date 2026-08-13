import {readFile, readdir, mkdir, rm, stat as statFile} from 'node:fs/promises';
import {basename, resolve} from 'node:path';
import {createNativeAdapterInstaller} from './adapter-installer.mjs';
import {verifyPackageManifestSignature} from './package-signing.mjs';
import {createReleaseFeedPlanner, createReleaseInstallRequest, verifyReleaseFeed} from './release-feed.mjs';
import {normalizeAdapterPackageManifest} from './adapter-package.mjs';

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

/** Resolve a bundled seed bundle root: feed, trusted public key, and artifact directory. */
export async function readSeedBundle({seedRoot, platform = process.platform} = {}) {
  const root = resolve(seedRoot || '.');
  const feed = JSON.parse(await readFile(resolve(root, 'feed.json'), 'utf8'));
  const publicKeyJwk = JSON.parse(await readFile(resolve(root, 'public-key.jwk.json'), 'utf8'));
  const artifacts = resolve(root, 'artifacts');
  await statFile(artifacts).catch(() => { throw new Error(`seed artifact directory is missing: ${artifacts}`); });
  return Object.freeze({seedRoot: root, feed, publicKeyJwk, artifacts});
}

/** Map a signed feed artifact URL to a bundled seed file by URL basename. */
export function createSeedArtifactResolver({seedRoot, artifacts} = {}) {
  const artifactDirectory = resolve(artifacts || resolve(seedRoot || '.', 'artifacts'));
  return async url => {
    const name = basename(String(url));
    if (!name || name === '.' || name === '..' || name.includes('/') || name.includes('\\')) throw new Error(`unsafe bundled artifact reference: ${url}`);
    const bytes = await readFile(resolve(artifactDirectory, name));
    if (bytes.byteLength === 0) throw new Error(`bundled artifact is empty: ${name}`);
    return bytes;
  };
}

/** Render the context-script body exposing the bundled seed to the packaged GUI. */
export async function createSeedContextScript({seedRoot, path = 'spartan-seed-context.js', platform = process.platform} = {}) {
  const bundle = await readSeedBundle({seedRoot, platform});
  if (!await verifyReleaseFeed({feed: bundle.feed, publicKeyJwk: bundle.publicKeyJwk})) throw new Error('bundled release feed signature verification failed');
  const manifests = Object.freeze(bundle.feed.records.map(record => record.package).filter(Boolean));
  const render = () => {
    const body = [
      'globalThis.__SPARTAN_RELEASE_FEED__ = ' + JSON.stringify(bundle.feed) + ';',
      'globalThis.__SPARTAN_ADAPTER_MANIFESTS__ = ' + JSON.stringify(manifests) + ';'
    ].join('\n');
    return body;
  };
  return Object.freeze({path, render});
}

/**
 * Replay a bundled signed feed into the per-user adapter home on first run.
 * The feed itself is signature-verified; each package manifest is re-verified;
 * bundled artifact bytes are still checked against the signed size + digest.
 */
export async function runSeedInstall({seedRoot, installRoot, platform = process.platform, apply = false, download = null} = {}) {
  if (!['win32', 'darwin', 'linux'].includes(platform)) throw new TypeError(`unsupported seed platform: ${platform}`);
  const bundle = await readSeedBundle({seedRoot, platform});
  if (!await verifyReleaseFeed({feed: bundle.feed, publicKeyJwk: bundle.publicKeyJwk})) throw new Error('bundled release feed signature verification failed');
  const artifactResolver = download || createSeedArtifactResolver({seedRoot});
  const installed = await readInstalledRecords(installRoot, platform);
  const planner = createReleaseFeedPlanner({feed: bundle.feed, platform, kind: 'emulator', installed});
  const installs = planner.plans.filter(plan => plan.status === 'install-available' || plan.status === 'update-available');
  const results = [];
  if (apply && installs.length) {
    await mkdir(installRoot, {recursive: true});
    const verifier = async args => { const source = args.manifest || args.request?.package; if (!source) throw new Error('packaged emulator release is required'); return verifyPackageManifestSignature({manifest: normalizeAdapterPackageManifest(source), publicKeyJwk: bundle.publicKeyJwk}); };
    const installer = createNativeAdapterInstaller({installRoot, download: artifactResolver, verifySignature: verifier, verifyPackageManifest: verifier});
    for (const plan of installs) {
      const request = createReleaseInstallRequest({plan, platform, consent: true});
      results.push(await installer.install(request));
    }
    await rm(resolve(installRoot, '.staging'), {recursive: true, force: true}).catch(() => {});
  }
  return Object.freeze({platform, verified: true, seedRoot: bundle.seedRoot, plans: planner.plans, installs: Object.freeze(installs), applied: Object.freeze(results)});
}
