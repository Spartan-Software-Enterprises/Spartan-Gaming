#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createFrontendServer } from '../frontend/serve.mjs';
import { loadChromiumManifest, validateChromiumManifest } from '../../chromium/config.mjs';

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
function platformFor(value) {
  const platform =
    text(value) || { linux: 'linux', darwin: 'mac', win32: 'windows' }[process.platform] || 'linux';
  if (!supportedPlatforms.has(platform))
    throw new Error(`unsupported Chromium platform: ${platform}`);
  return platform;
}
function safeUrl(value) {
  const parsed = new URL(required(value, 'url'));
  if (parsed.protocol === 'https:') return parsed.href;
  if (parsed.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname))
    throw new Error('Chromium shell URLs must use HTTPS or loopback HTTP');
  return parsed.href;
}

export function parseLaunchArguments(argv = []) {
  const options = {
    platform: null,
    binary: '',
    out: '',
    url: '',
    frontendRoot: '',
    userDataDir: '',
    serve: false,
    execute: false,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--serve') options.serve = true;
    else if (argument === '--execute') options.execute = true;
    else if (argument === '--json') options.json = true;
    else if (argument === '--platform') options.platform = argv[++index];
    else if (argument === '--binary') options.binary = argv[++index];
    else if (argument === '--out') options.out = argv[++index];
    else if (argument === '--url') options.url = argv[++index];
    else if (argument === '--frontend-root') options.frontendRoot = argv[++index];
    else if (argument === '--user-data-dir') options.userDataDir = argv[++index];
    else if (argument === '--help' || argument === '-h') options.help = true;
    else throw new Error(`unknown launch option: ${argument}`);
  }
  return Object.freeze(options);
}

export function chromiumBinaryPath({ platform, out, binary } = {}) {
  if (text(binary)) return externalPath(binary, 'binary');
  const output = externalPath(out, 'out');
  if (platform === 'mac') return path.join(output, 'Chromium.app', 'Contents', 'MacOS', 'Chromium');
  return path.join(output, platform === 'windows' ? 'chrome.exe' : 'chrome');
}

export function createChromiumShellPlan({
  manifest = loadChromiumManifest(),
  platform,
  out,
  binary,
  url = 'http://127.0.0.1:4173/dashboard/?startup=1',
  userDataDir = '',
} = {}) {
  validateChromiumManifest(manifest);
  const selectedPlatform = platformFor(platform);
  const descriptor = manifest.targets.find((target) => target.id === selectedPlatform);
  if (!descriptor) throw new Error(`manifest has no target for ${selectedPlatform}`);
  const binaryPath = chromiumBinaryPath({ platform: selectedPlatform, out, binary });
  const args = [`--app=${safeUrl(url)}`, '--no-first-run', '--no-default-browser-check'];
  if (text(userDataDir)) args.push(`--user-data-dir=${externalPath(userDataDir, 'userDataDir')}`);
  return Object.freeze({
    platform: selectedPlatform,
    binary: binaryPath,
    url: safeUrl(url),
    artifact: descriptor.artifact,
    args: Object.freeze(args),
    command: Object.freeze({
      program: binaryPath,
      args: Object.freeze(args),
      cwd: path.dirname(binaryPath),
      shell: false,
    }),
  });
}

export function executeChromiumShellPlan(plan, { spawnImpl = spawn } = {}) {
  if (!plan?.command?.program) throw new TypeError('a Chromium shell plan is required');
  if (!fs.existsSync(plan.command.program))
    throw new Error(`Chromium binary does not exist: ${plan.command.program}`);
  return spawnImpl(plan.command.program, plan.command.args, {
    cwd: plan.command.cwd,
    shell: false,
    stdio: 'inherit',
  });
}

export async function launchChromiumShell({
  plan,
  serve = false,
  frontendRoot,
  publicRoot,
  spawnImpl = spawn,
} = {}) {
  let frontend;
  let activePlan = plan;
  if (serve) {
    frontend = createFrontendServer({
      host: '127.0.0.1',
      port: 0,
      ...(frontendRoot ? { root: frontendRoot } : {}),
      ...(publicRoot ? { publicRoot } : {}),
    });
    const address = await frontend.listen();
    const url = `http://127.0.0.1:${address.port}/dashboard/?startup=1`;
    activePlan = createChromiumShellPlan({ ...plan, url });
  }
  try {
    const child = executeChromiumShellPlan(activePlan, { spawnImpl });
    return Object.freeze({
      plan: activePlan,
      child,
      async close() {
        child.kill?.();
        await frontend?.close();
      },
    });
  } catch (error) {
    await frontend?.close();
    throw error;
  }
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || '')) {
  try {
    const options = parseLaunchArguments(process.argv.slice(2));
    if (options.help) {
      console.log(
        'Usage: npm run chromium:launch -- --binary PATH|--out PATH [--platform linux|mac|windows] [--url URL] [--serve] [--frontend-root PATH] [--user-data-dir PATH] [--execute] [--json]',
      );
      process.exit(0);
    }
    const plan = createChromiumShellPlan({
      platform: options.platform,
      binary: options.binary,
      out: options.out,
      url: options.url || undefined,
      userDataDir: options.userDataDir,
    });
    if (options.json || !options.execute) console.log(JSON.stringify(plan, null, 2));
    if (options.execute) {
      const running = await launchChromiumShell({
        plan,
        serve: options.serve,
        frontendRoot: options.frontendRoot,
        publicRoot: options.frontendRoot,
        spawnImpl: spawn,
      });
      console.log(
        JSON.stringify({
          service: 'spartan-chromium-shell',
          platform: running.plan.platform,
          url: running.plan.url,
          binary: running.plan.binary,
        }),
      );
      running.child.once?.('exit', () => {
        void running.close();
      });
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
