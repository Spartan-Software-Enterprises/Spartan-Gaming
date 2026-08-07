#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromiumManifestPath, loadChromiumManifest, validateChromiumManifest, validateGnArgsFile } from '../../chromium/config.mjs';

const args = new Set(process.argv.slice(2));
const platformIndex = process.argv.indexOf('--platform');
const requestedPlatform = platformIndex >= 0 ? process.argv[platformIndex + 1] : null;
const platform = requestedPlatform ?? ({ win32: 'windows', darwin: 'mac', linux: 'linux' }[process.platform] ?? process.platform);
const strict = args.has('--strict');

function commandExists(command) {
  const result = spawnSync(command, ['--version'], { stdio: 'ignore', shell: process.platform === 'win32' });
  return !result.error && result.status === 0;
}

function printStatus(label, available, detail = '') {
  console.log(`${available ? 'ok' : 'missing'}  ${label}${detail ? ` (${detail})` : ''}`);
}

const manifest = loadChromiumManifest(chromiumManifestPath);
validateChromiumManifest(manifest);
const target = manifest.targets.find((entry) => entry.id === platform);
if (!target) throw new Error(`unsupported platform: ${platform}`);

console.log(`Spartan Gaming Chromium environment: ${platform} on ${os.platform()} ${os.arch()}`);
console.log(`Manifest: ${path.relative(process.cwd(), chromiumManifestPath)}`);
console.log(`Source policy: ${manifest.source.channel}; branch: ${manifest.source.branch}`);

const tools = ['git', 'python3', 'gclient', 'gn', 'autoninja'];
const missing = [];
for (const tool of tools) {
  const available = commandExists(tool);
  printStatus(tool, available);
  if (!available) missing.push(tool);
}

const source = process.env.SPARTAN_CHROMIUM_SRC;
if (source) printStatus('SPARTAN_CHROMIUM_SRC', fs.existsSync(source), source);
else printStatus('SPARTAN_CHROMIUM_SRC', false, 'not set; checkout remains external to this repository');

const gnPath = path.resolve(target.args);
validateGnArgsFile(gnPath);
printStatus(`${target.args}`, true, 'validated');

if (strict && missing.length > 0) {
  console.error(`missing required Chromium tools: ${missing.join(', ')}`);
  process.exitCode = 1;
}
