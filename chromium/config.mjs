import fs from 'node:fs';
import path from 'node:path';

export const chromiumManifestPath = path.resolve('chromium/build-manifest.json');

const requiredManifestKeys = ['schemaVersion', 'product', 'source', 'checkout', 'targets'];
const allowedGnKeys = new Set([
  'blink_symbol_level',
  'enable_nacl',
  'is_component_build',
  'is_official_build',
  'ozone_auto_platforms',
  'symbol_level',
  'target_cpu',
  'use_ozone',
  'use_rtti',
]);

export function loadChromiumManifest(manifestPath = chromiumManifestPath) {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

export function parseGnArgs(text) {
  const assignments = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, '').trim();
    if (!line) continue;
    const match = line.match(/^([a-z][a-z0-9_]*)\s*=\s*(.+)$/);
    if (!match) throw new Error(`invalid GN assignment: ${rawLine.trim()}`);
    const [, key, value] = match;
    if (!allowedGnKeys.has(key)) throw new Error(`unsupported GN key: ${key}`);
    assignments[key] = value.trim();
  }
  return assignments;
}

export function validateChromiumManifest(manifest) {
  for (const key of requiredManifestKeys) {
    if (!(key in manifest)) throw new Error(`manifest is missing ${key}`);
  }
  if (manifest.schemaVersion !== 1) throw new Error('unsupported Chromium manifest schema');
  if (manifest.product !== 'Spartan Gaming') throw new Error('manifest product must be Spartan Gaming');
  if (manifest.source.repository !== 'https://chromium.googlesource.com/chromium/src.git') {
    throw new Error('manifest must use the upstream Chromium source repository');
  }
  if (manifest.source.branch !== 'refs/heads/main' && !/^refs\/branch-heads\/[0-9]+$/.test(manifest.source.branch || '')) throw new Error('manifest must select Chromium main or a numeric stable branch-head');
  if (!Array.isArray(manifest.targets) || manifest.targets.length < 3) {
    throw new Error('manifest must describe Linux, macOS, and Windows targets');
  }
  const ids = new Set(manifest.targets.map((target) => target.id));
  for (const id of ['linux', 'mac', 'windows']) if (!ids.has(id)) throw new Error(`missing target: ${id}`);
  return true;
}

export function validateGnArgsFile(filePath) {
  const args = parseGnArgs(fs.readFileSync(filePath, 'utf8'));
  for (const key of ['is_official_build', 'is_component_build', 'symbol_level']) {
    if (!(key in args)) throw new Error(`${filePath} is missing ${key}`);
  }
  if (args.is_official_build !== 'false') throw new Error(`${filePath} must remain a development template`);
  return args;
}
