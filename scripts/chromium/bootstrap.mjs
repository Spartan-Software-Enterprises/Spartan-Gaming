#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  chromiumManifestPath,
  loadChromiumManifest,
  validateChromiumManifest,
} from '../../chromium/config.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const supportedPlatforms = new Set(['linux', 'mac', 'windows']);

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}
function required(value, name) {
  const result = text(value);
  if (!result) throw new TypeError(`${name} is required`);
  return result;
}
function externalPath(value, name) {
  const result = path.resolve(required(value, name));
  if (result === repositoryRoot || result.startsWith(`${repositoryRoot}${path.sep}`))
    throw new Error(`${name} must remain outside the Spartan Gaming repository`);
  return result;
}

export function parseBootstrapArguments(argv = []) {
  const options = { platform: null, checkout: '', execute: false, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--execute') options.execute = true;
    else if (argument === '--json') options.json = true;
    else if (argument === '--platform') options.platform = argv[++index];
    else if (argument === '--checkout') options.checkout = argv[++index];
    else if (argument === '--help' || argument === '-h') options.help = true;
    else throw new Error(`unknown bootstrap option: ${argument}`);
  }
  return Object.freeze(options);
}

export function createChromiumBootstrapPlan({
  manifest = loadChromiumManifest(chromiumManifestPath),
  platform,
  checkout,
  root = repositoryRoot,
} = {}) {
  validateChromiumManifest(manifest);
  const selectedPlatform = required(platform, 'platform');
  if (!supportedPlatforms.has(selectedPlatform))
    throw new Error(`unsupported Chromium platform: ${selectedPlatform}`);
  const checkoutRoot = externalPath(checkout, 'checkout');
  const source = path.join(checkoutRoot, 'src');
  const branch = manifest.source.branch;
  const commands = [];
  if (!fs.existsSync(source))
    commands.push(
      Object.freeze({
        program: 'fetch',
        args: Object.freeze(['--nohooks', 'chromium']),
        cwd: checkoutRoot,
      }),
    );
  commands.push(
    Object.freeze({
      program: 'git',
      args: Object.freeze(['-C', source, 'fetch', 'origin', branch]),
      cwd: checkoutRoot,
    }),
  );
  commands.push(
    Object.freeze({
      program: 'git',
      args: Object.freeze(['-C', source, 'checkout', '--detach', 'FETCH_HEAD']),
      cwd: checkoutRoot,
    }),
  );
  commands.push(
    Object.freeze({
      program: 'gclient',
      args: Object.freeze(['sync', '--nohooks']),
      cwd: checkoutRoot,
    }),
  );
  commands.push(
    Object.freeze({ program: 'gclient', args: Object.freeze(['runhooks']), cwd: checkoutRoot }),
  );
  return Object.freeze({
    platform: selectedPlatform,
    checkout: checkoutRoot,
    source,
    branch,
    manifest: path.relative(root, chromiumManifestPath),
    commands: Object.freeze(commands),
  });
}

function commandAvailable(program) {
  const result = spawnSync(program, program === 'fetch' ? ['--help'] : ['--version'], {
    stdio: 'ignore',
    shell: process.platform === 'win32',
  });
  return !result.error && result.status === 0;
}

export function executeChromiumBootstrap(plan) {
  if (!fs.existsSync(plan.checkout)) fs.mkdirSync(plan.checkout, { recursive: true });
  for (const command of plan.commands) {
    if (!commandAvailable(command.program))
      throw new Error(`required Chromium checkout tool is unavailable: ${command.program}`);
    const result = spawnSync(command.program, command.args, {
      cwd: command.cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    if (result.error) throw result.error;
    if (result.status !== 0)
      throw new Error(`${command.program} exited with status ${result.status}`);
  }
  return plan.source;
}

function printPlan(plan, json) {
  if (json) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }
  console.log(`Spartan Gaming Chromium bootstrap plan (${plan.platform})`);
  console.log(`checkout: ${plan.checkout}`);
  console.log(`source: ${plan.source}`);
  console.log(`ref: ${plan.branch}`);
  for (const command of plan.commands)
    console.log(
      `  ${command.program} ${command.args.map((argument) => JSON.stringify(argument)).join(' ')}`,
    );
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || '')) {
  try {
    const options = parseBootstrapArguments(process.argv.slice(2));
    if (options.help) {
      console.log(
        'Usage: npm run chromium:bootstrap -- --platform linux|mac|windows --checkout PATH [--execute] [--json]',
      );
      process.exit(0);
    }
    const platform =
      options.platform ||
      { linux: 'linux', darwin: 'mac', win32: 'windows' }[process.platform] ||
      'linux';
    const plan = createChromiumBootstrapPlan({ platform, checkout: options.checkout });
    printPlan(plan, options.json);
    if (options.execute) executeChromiumBootstrap(plan);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
