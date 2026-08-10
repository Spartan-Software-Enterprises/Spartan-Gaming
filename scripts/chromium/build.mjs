#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {loadChromiumManifest, validateChromiumManifest, validateGnArgsFile} from '../../chromium/config.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const manifestPath = path.join(repositoryRoot, 'chromium/build-manifest.json');
const supportedPlatforms = new Set(['linux', 'mac', 'windows']);

function text(value) { return typeof value === 'string' ? value.trim() : ''; }
function required(value, name) { const result = text(value); if (!result) throw new TypeError(`${name} is required`); return result; }

export function parseBuildArguments(argv = []) {
  const options = {platform: null, source: process.env.SPARTAN_CHROMIUM_SRC || '', out: '', target: '', execute: false, json: false, matrix: false};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--execute') options.execute = true;
    else if (argument === '--json') options.json = true;
    else if (argument === '--matrix') options.matrix = true;
    else if (argument === '--platform') options.platform = argv[++index];
    else if (argument === '--source') options.source = argv[++index];
    else if (argument === '--out') options.out = argv[++index];
    else if (argument === '--target') options.target = argv[++index];
    else if (argument === '--help' || argument === '-h') options.help = true;
    else throw new Error(`unknown build option: ${argument}`);
  }
  return Object.freeze(options);
}

function currentPlatform() { return ({linux: 'linux', darwin: 'mac', win32: 'windows'}[process.platform] || 'linux'); }

export function createChromiumBuildPlan({manifest = loadChromiumManifest(manifestPath), platform = currentPlatform(), source, out, target, root = repositoryRoot} = {}) {
  validateChromiumManifest(manifest);
  const selectedPlatform = required(platform, 'platform');
  if (!supportedPlatforms.has(selectedPlatform)) throw new Error(`unsupported Chromium platform: ${selectedPlatform}`);
  const descriptor = manifest.targets.find(entry => entry.id === selectedPlatform);
  if (!descriptor) throw new Error(`manifest has no target for ${selectedPlatform}`);
  const sourceDirectory = path.resolve(required(source, 'source'));
  const outputDirectory = path.resolve(sourceDirectory, text(out) || `out/SpartanGaming-${selectedPlatform}`);
  if (outputDirectory === sourceDirectory) throw new Error('build output must not equal the Chromium source directory');
  if (outputDirectory === repositoryRoot || outputDirectory.startsWith(`${repositoryRoot}${path.sep}`)) throw new Error('build output must remain outside the Spartan Gaming repository');
  const buildTarget = text(target) || descriptor.buildTarget;
  const argsPath = path.resolve(root, descriptor.args);
  const argsText = fs.readFileSync(argsPath, 'utf8').trim();
  validateGnArgsFile(argsPath);
  return Object.freeze({platform: selectedPlatform, source: sourceDirectory, out: outputDirectory, target: buildTarget, artifact: descriptor.artifact, binary: descriptor.binary, argsPath, commands: Object.freeze([
    Object.freeze({program: 'gn', args: Object.freeze(['gen', outputDirectory, `--args=${argsText}`]), cwd: sourceDirectory}),
    Object.freeze({program: 'autoninja', args: Object.freeze(['-C', outputDirectory, buildTarget]), cwd: sourceDirectory}),
  ])});
}

export function createChromiumDevelopmentBuildMatrix({manifest = loadChromiumManifest(manifestPath), source, outRoot, root = repositoryRoot} = {}) {
  validateChromiumManifest(manifest); const sourceDirectory = path.resolve(required(source, 'source')); const outputRoot = text(outRoot) ? path.resolve(outRoot) : path.join(sourceDirectory, 'out', 'SpartanGaming');
  if (outputRoot === repositoryRoot || outputRoot.startsWith(`${repositoryRoot}${path.sep}`)) throw new Error('matrix output must remain outside the Spartan Gaming repository');
  return Object.freeze(['linux', 'mac', 'windows'].map(platform => createChromiumBuildPlan({manifest, platform, source: sourceDirectory, out: path.join(outputRoot, platform), root})));
}

function printPlan(plan, json) {
  if (json) { console.log(JSON.stringify(plan, null, 2)); return; }
  console.log(`Spartan Gaming Chromium build plan (${plan.platform})`);
  console.log(`source: ${plan.source}`); console.log(`output: ${plan.out}`); console.log(`target: ${plan.target}`);
  for (const command of plan.commands) console.log(`  ${command.program} ${command.args.map(argument => JSON.stringify(argument)).join(' ')}`);
}

function commandAvailable(program) {
  const result = spawnSync(program, ['--version'], {stdio: 'ignore', shell: process.platform === 'win32'});
  return !result.error && result.status === 0;
}

export function executeChromiumBuild(plan) {
  if (!fs.existsSync(plan.source)) throw new Error(`Chromium source directory does not exist: ${plan.source}`);
  for (const command of plan.commands) {
    if (!commandAvailable(command.program)) throw new Error(`required Chromium build tool is unavailable: ${command.program}`);
    const result = spawnSync(command.program, command.args, {cwd: command.cwd, stdio: 'inherit', shell: process.platform === 'win32'});
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${command.program} exited with status ${result.status}`);
  }
  return true;
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || '')) {
  try {
    const options = parseBuildArguments(process.argv.slice(2));
    if (options.help) { console.log('Usage: npm run chromium:build -- [--platform linux|mac|windows] [--matrix] [--source PATH] [--out PATH] [--target chrome] [--execute] [--json]'); process.exit(0); }
    const platform = options.platform || currentPlatform();
    if (options.matrix) { const plans = createChromiumDevelopmentBuildMatrix({source: options.source, outRoot: options.out}); if (options.json) console.log(JSON.stringify(plans, null, 2)); else plans.forEach(printPlan); if (options.execute) plans.forEach(executeChromiumBuild); }
    else { const plan = createChromiumBuildPlan({platform, source: options.source, out: options.out, target: options.target}); printPlan(plan, options.json); if (options.execute) executeChromiumBuild(plan); }
  } catch (error) {
    console.error(error.message); process.exitCode = 1;
  }
}
