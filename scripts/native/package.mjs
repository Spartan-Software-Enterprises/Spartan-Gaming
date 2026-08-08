#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createNativePackageBuildPlan, loadNativePackageManifest, normalizeNativePackageManifest} from '../../host/native-package.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PLATFORM_ALIASES = Object.freeze({windows: 'win32', win32: 'win32', macos: 'darwin', mac: 'darwin', darwin: 'darwin', linux: 'linux'});
const PLATFORMS = Object.freeze(['win32', 'darwin', 'linux']);

function required(value, name) { if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} is required`); return value.trim(); }
function platform(value) { const selected = PLATFORM_ALIASES[String(value || '').toLowerCase()]; if (!selected) throw new TypeError(`unsupported native package platform: ${value}`); return selected; }

export function parseNativePackageArguments(argv = []) {
  const options = {platform: null, sourceRoot: repositoryRoot, outRoot: '', installRoot: '', configuration: 'Release', matrix: false, execute: false, json: false};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--matrix') options.matrix = true;
    else if (argument === '--execute') options.execute = true;
    else if (argument === '--json') options.json = true;
    else if (argument === '--platform') options.platform = argv[++index];
    else if (argument === '--source-root') options.sourceRoot = argv[++index];
    else if (argument === '--out-root') options.outRoot = argv[++index];
    else if (argument === '--install-root') options.installRoot = argv[++index];
    else if (argument === '--configuration') options.configuration = argv[++index];
    else if (argument === '--help' || argument === '-h') options.help = true;
    else throw new Error(`unknown native package option: ${argument}`);
  }
  return Object.freeze(options);
}

export function createNativePackagePlan({manifest = loadNativePackageManifest(), platform: selectedPlatform, sourceRoot = repositoryRoot, outRoot, installRoot, configuration = 'Release'} = {}) {
  const target = platform(selectedPlatform);
  const plan = createNativePackageBuildPlan({manifest, platform: target, sourceRoot, outRoot, installRoot, configuration});
  return Object.freeze({...plan, sourcePresent: fs.existsSync(plan.source), platform: target});
}

export function createNativePackageMatrix({manifest = loadNativePackageManifest(), sourceRoot = repositoryRoot, outRoot, installRoot, configuration = 'Release'} = {}) {
  const normalized = normalizeNativePackageManifest(manifest);
  return Object.freeze(normalized.packages.map(entry => createNativePackagePlan({manifest: normalized, platform: entry.platform, sourceRoot, outRoot: outRoot ? path.join(outRoot, entry.platform) : undefined, installRoot: installRoot ? path.join(installRoot, entry.platform) : undefined, configuration})));
}

function commandAvailable(program) { const result = spawnSync(program, ['--version'], {stdio: 'ignore', shell: process.platform === 'win32'}); return !result.error && result.status === 0; }
export function executeNativePackagePlan(plan) {
  if (!plan.sourcePresent) throw new Error(`native package source directory does not exist: ${plan.source}`);
  for (const command of plan.commands) {
    if (!commandAvailable(command.program)) throw new Error(`required native package tool is unavailable: ${command.program}`);
    const result = spawnSync(command.program, command.args, {cwd: command.cwd, stdio: 'inherit', shell: process.platform === 'win32'});
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${command.program} exited with status ${result.status}`);
  }
  return true;
}

function print(plan, json) {
  if (json) { console.log(JSON.stringify(plan, null, 2)); return; }
  console.log(`Spartan Gaming native package plan (${plan.platform})`);
  console.log(`package: ${plan.package.packageName}`); console.log(`source: ${plan.source} (${plan.sourcePresent ? 'present' : 'not present'})`); console.log(`output: ${plan.out}`); console.log(`install: ${plan.install}`);
  for (const command of plan.commands) console.log(`  ${command.program} ${command.args.map(argument => JSON.stringify(argument)).join(' ')}`);
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || '')) {
  try {
    const options = parseNativePackageArguments(process.argv.slice(2));
    if (options.help) { console.log('Usage: npm run native:plan -- --platform windows|macos|linux [--source-root PATH] [--out-root PATH] [--install-root PATH] [--configuration Release] [--execute] [--json]'); process.exit(0); }
    const plans = options.matrix ? createNativePackageMatrix({sourceRoot: options.sourceRoot, outRoot: options.outRoot, installRoot: options.installRoot, configuration: options.configuration}) : [createNativePackagePlan({platform: options.platform || ({win32: 'win32', darwin: 'darwin', linux: 'linux'}[process.platform] || 'linux'), sourceRoot: options.sourceRoot, outRoot: options.outRoot, installRoot: options.installRoot, configuration: options.configuration})];
    if (options.json) console.log(JSON.stringify(options.matrix ? plans : plans[0], null, 2)); else plans.forEach(plan => print(plan, false));
    if (options.execute) plans.forEach(executeNativePackagePlan);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
