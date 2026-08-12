#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { promises as defaultFs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ALIASES = Object.freeze({
  windows: 'win32',
  win32: 'win32',
  macos: 'darwin',
  mac: 'darwin',
  darwin: 'darwin',
  linux: 'linux',
});
function required(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} is required`);
  return value.trim();
}
function selectedPlatform(value) {
  const result = ALIASES[String(value || '').toLowerCase()];
  if (!result) throw new TypeError(`unsupported native package platform: ${value}`);
  return result;
}
function digest(bytes) {
  return `sha256-${createHash('sha256').update(bytes).digest('base64url')}`;
}
function relativeFile(root, target) {
  const value = path.relative(root, target).split(path.sep).join('/');
  if (!value || value.startsWith('../') || path.isAbsolute(value))
    throw new Error('native package entry escaped the install root');
  return value;
}

async function collect(root, current, fsImpl, files) {
  const entries = await fsImpl.readdir(current, { withFileTypes: true });
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const target = path.join(current, entry.name);
    const relative = relativeFile(root, target);
    if (entry.isDirectory()) {
      files.push({ path: relative, type: 'directory', sizeBytes: 0 });
      await collect(root, target, fsImpl, files);
      continue;
    }
    if (!entry.isFile()) throw new Error(`native package contains unsupported entry: ${relative}`);
    const bytes = await fsImpl.readFile(target);
    files.push({
      path: relative,
      type: 'file',
      sizeBytes: bytes.byteLength,
      integrity: digest(bytes),
    });
  }
}

export async function createUnsignedNativePackageManifest({
  installRoot,
  platform,
  version,
  outputPath,
  fsImpl = defaultFs,
} = {}) {
  const root = path.resolve(required(installRoot, 'installRoot'));
  const targetPlatform = selectedPlatform(platform);
  const release = required(version, 'version');
  const files = [];
  await collect(root, root, fsImpl, files);
  if (!files.some((file) => file.path === 'index.mjs' && file.type === 'file'))
    throw new Error('native package install must contain index.mjs');
  const manifest = Object.freeze({
    id: `native-${targetPlatform}`,
    version: release,
    kind: 'input',
    platform: targetPlatform,
    format: 'directory',
    files: Object.freeze(files),
    entrypoint: 'index.mjs',
  });
  if (!outputPath) return manifest;
  const destination = path.resolve(outputPath);
  await fsImpl.writeFile(destination, JSON.stringify(manifest, null, 2) + '\n', {
    encoding: 'utf8',
    flag: 'wx',
  });
  return Object.freeze({ ...manifest, outputPath: destination });
}

function argument(argv, name) {
  const index = argv.indexOf(name);
  return index < 0 ? '' : argv[index + 1];
}
if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || '')) {
  try {
    const argv = process.argv.slice(2);
    const manifest = await createUnsignedNativePackageManifest({
      installRoot: argument(argv, '--install-root'),
      platform: argument(argv, '--platform'),
      version: argument(argv, '--version'),
      outputPath: argument(argv, '--output'),
    });
    console.log(
      JSON.stringify({
        status: 'unsigned-manifest-written',
        id: manifest.id,
        version: manifest.version,
        platform: manifest.platform,
        files: manifest.files.length,
        outputPath: manifest.outputPath,
      }),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
