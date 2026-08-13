import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PLATFORMS = new Set(['win32', 'darwin', 'linux']);
const FORMATS = new Set(['node-addon']);
const CONFIGURATIONS = new Set(['Debug', 'Release', 'RelWithDebInfo', 'MinSizeRel']);
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(repositoryRoot, 'native/package-manifest.json');

function required(value, name) {
  if (typeof value !== 'string' || !value.trim())
    throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}
function safeRelative(value, name) {
  const normalized = required(value, name).replaceAll('\\', '/');
  if (
    normalized.startsWith('/') ||
    normalized.split('/').some((part) => !SAFE_SEGMENT.test(part) || part === '..')
  )
    throw new TypeError(`${name} must be a safe relative path`);
  return normalized;
}
function list(value, name) {
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.some((item) => typeof item !== 'string' || !item.trim())
  )
    throw new TypeError(`${name} must contain non-empty strings`);
  return Object.freeze([...new Set(value.map((item) => item.trim()))]);
}

export function loadNativePackageManifest(filePath = manifestPath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function normalizeNativePackageManifest(record) {
  if (
    record?.schemaVersion !== 1 ||
    record.buildSystem !== 'cmake' ||
    !Array.isArray(record.packages) ||
    !record.packages.length
  )
    throw new TypeError('native package manifest must use schemaVersion 1 and CMake');
  const packages = record.packages.map((entry, index) => {
    const id = required(entry?.id, `native.packages[${index}].id`);
    const platform = required(entry?.platform, `native.packages[${index}].platform`);
    if (!PLATFORMS.has(platform))
      throw new TypeError(`unsupported native package platform: ${platform}`);
    const packageName = required(entry?.packageName, `native.packages[${index}].packageName`);
    if (!packageName.startsWith('@spartan-gaming/native-'))
      throw new TypeError('native package names must use the Spartan scope');
    const format = required(entry?.format, `native.packages[${index}].format`);
    if (!FORMATS.has(format)) throw new TypeError(`unsupported native package format: ${format}`);
    const artifactName = required(entry?.artifactName, `native.packages[${index}].artifactName`);
    const sourceDirectory = safeRelative(
      entry?.sourceDirectory,
      `native.packages[${index}].sourceDirectory`,
    );
    return Object.freeze({
      id,
      platform,
      packageName,
      format,
      requiredApis: list(entry?.requiredApis, `native.packages[${index}].requiredApis`),
      sourceDirectory,
      artifactName,
    });
  });
  if (new Set(packages.map((entry) => entry.platform)).size !== packages.length)
    throw new Error('native package manifest must contain one package per platform');
  return Object.freeze({
    schemaVersion: 1,
    buildSystem: 'cmake',
    packages: Object.freeze(packages),
  });
}

export function createNativePackageBuildPlan({
  manifest = loadNativePackageManifest(),
  platform,
  sourceRoot = repositoryRoot,
  outRoot,
  installRoot,
  configuration = 'Release',
} = {}) {
  const normalized = normalizeNativePackageManifest(manifest);
  const selected = normalized.packages.find((entry) => entry.platform === platform);
  if (!selected) throw new TypeError(`no native package is defined for ${platform}`);
  if (!CONFIGURATIONS.has(configuration))
    throw new TypeError(`unsupported native package configuration: ${configuration}`);
  const source = path.resolve(sourceRoot, selected.sourceDirectory);
  const out = path.resolve(outRoot || path.join(sourceRoot, 'out', selected.id));
  const install = path.resolve(installRoot || path.join(out, 'install'));
  if (out === source || install === source)
    throw new Error('native package output must not overwrite source');
  return Object.freeze({
    package: selected,
    source,
    out,
    install,
    configuration,
    commands: Object.freeze([
      Object.freeze({
        program: 'cmake',
        args: Object.freeze(['-S', source, '-B', out, `-DCMAKE_BUILD_TYPE=${configuration}`]),
        cwd: source,
      }),
      Object.freeze({
        program: 'cmake',
        args: Object.freeze(['--build', out, '--config', configuration]),
        cwd: source,
      }),
      Object.freeze({
        program: 'cmake',
        args: Object.freeze(['--install', out, '--prefix', install]),
        cwd: source,
      }),
    ]),
  });
}

export function nativePackageReadiness({
  manifest = loadNativePackageManifest(),
  platform,
  packageProbe = () => false,
  toolProbe = () => false,
} = {}) {
  const normalized = normalizeNativePackageManifest(manifest);
  const selected = normalized.packages.find((entry) => entry.platform === platform);
  if (!selected)
    return Object.freeze({
      status: 'unavailable',
      platform,
      reason: 'no native package is defined for this platform',
    });
  const packageInstalled = Boolean(packageProbe(selected.packageName));
  const cmakeAvailable = Boolean(toolProbe('cmake'));
  return Object.freeze({
    status: packageInstalled ? 'ready' : 'planned',
    platform,
    packageName: selected.packageName,
    packageInstalled,
    cmakeAvailable,
    requiredApis: selected.requiredApis,
    reason: packageInstalled
      ? 'native package is installed'
      : 'signed native package must be built and installed',
  });
}

export const NATIVE_PACKAGE_MANIFEST_PATH = manifestPath;
