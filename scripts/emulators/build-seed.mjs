import {createHash} from 'node:crypto';
import {readFile, readdir, mkdir, copyFile, stat, writeFile} from 'node:fs/promises';
import {basename, join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyReleaseFeed} from '../../host/release-feed.mjs';

export function parseBuildSeedArgs(argv = process.argv.slice(2)) {
  const options = {feed: null, key: null, artifacts: null, out: null};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--feed') options.feed = argv[++index];
    else if (flag === '--key') options.key = argv[++index];
    else if (flag === '--artifacts') options.artifacts = argv[++index];
    else if (flag === '--out') options.out = argv[++index];
    else if (flag === '--help') options.help = true;
    else throw new TypeError(`unknown seed build flag: ${flag}`);
  }
  if (!options.feed || !options.key || !options.artifacts || !options.out) throw new TypeError('--feed, --key, --artifacts, and --out are required');
  return options;
}

function decodeDigest(value) {
  if (!String(value).startsWith('sha256-')) throw new TypeError('artifact.integrity must use sha256- encoding');
  return String(value).slice(7);
}

function assertArtifactName(name) {
  if (!name || name === '.' || name === '..' || name.includes('/') || name.includes('\\')) throw new TypeError(`unsafe artifact file name: ${name}`);
  return name;
}

/** Assemble a verified seed bundle from a signed feed, its trusted key, and local artifact files. */
export async function buildSeedBundle({feedPath, keyPath, artifacts, outPath} = {}) {
  const feed = JSON.parse(await readFile(resolve(feedPath), 'utf8'));
  const publicKeyJwk = JSON.parse(await readFile(resolve(keyPath), 'utf8'));
  if (!await verifyReleaseFeed({feed, publicKeyJwk})) throw new Error('release feed signature verification failed');
  const artifactRoot = resolve(artifacts);
  const entries = await readdir(artifactRoot, {withFileTypes: true});
  const bundled = new Map();
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const name = assertArtifactName(entry.name);
    bundled.set(name, (await stat(join(artifactRoot, name))).size);
  }
  const records = feed.records ?? [];
  if (!Array.isArray(records) || records.length === 0) throw new Error('release feed must contain records to bundle');
  const copied = [];
  const used = new Set();
  for (const record of records) {
    if (!record.artifact?.url) throw new TypeError(`release record ${record.id} has no artifact descriptor`);
    const name = assertArtifactName(basename(record.artifact.url));
    if (!bundled.has(name)) throw new Error(`missing bundled artifact for ${record.id}: ${name}`);
    if (bundled.get(name) !== record.artifact.sizeBytes) throw new Error(`bundled artifact size mismatch for ${record.id}: ${name}`);
    used.add(name); copied.push({id: record.id, version: record.version, name});
  }
  for (const name of bundled.keys()) if (!used.has(name)) throw new Error(`unreferenced artifact must not be bundled: ${name}`);
  const out = resolve(outPath);
  await mkdir(join(out, 'artifacts'), {recursive: true});
  await copyFile(resolve(feedPath), join(out, 'feed.json'));
  await copyFile(resolve(keyPath), join(out, 'public-key.jwk.json'));
  let verifiedBytes = 0;
  for (const item of copied) {
    const record = records.find(candidate => candidate.id === item.id);
    const source = join(artifactRoot, item.name);
    const bytes = await readFile(source);
    const digest = createHash('sha256').update(bytes).digest('base64url');
    if (bytes.byteLength !== record.artifact.sizeBytes || digest !== decodeDigest(record.artifact.integrity)) throw new Error(`bundled artifact digest mismatch for ${item.id}`);
    await copyFile(source, join(out, 'artifacts', item.name));
    verifiedBytes += bytes.byteLength;
  }
  await writeFile(join(out, 'manifest.json'), JSON.stringify({schemaVersion: 1, records: copied.length, bytes: verifiedBytes, signer: feed.signer ?? null}, null, 2), 'utf8');
  return Object.freeze({seedRoot: out, records: copied, bytes: verifiedBytes});
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseBuildSeedArgs(argv);
  if (options.help) { console.log('Usage: node scripts/emulators/build-seed.mjs --feed <feed.json> --key <public-jwk.json> --artifacts <dir> --out <seed-dir>'); return; }
  const summary = await buildSeedBundle({feedPath: options.feed, keyPath: options.key, artifacts: options.artifacts, outPath: options.out});
  console.log(JSON.stringify(summary, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
