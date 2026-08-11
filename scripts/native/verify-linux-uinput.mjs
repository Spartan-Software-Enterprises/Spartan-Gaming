#!/usr/bin/env node
import path from 'node:path';
import { access, constants, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}
function absolute(value, name) {
  const result = path.resolve(text(value) || '.');
  if (result === path.parse(result).root)
    throw new TypeError(`${name} cannot be the filesystem root`);
  return result;
}
function boundedTimeout(value) {
  const result = value === undefined ? 1000 : Number(value);
  if (!Number.isInteger(result) || result < 50 || result > 10_000)
    throw new RangeError('timeoutMs must be between 50 and 10000');
  return result;
}

const SEQUENCE = Object.freeze([
  Object.freeze({ kind: 'button', control: 'button-0', pressed: true }),
  Object.freeze({ kind: 'button', control: 'button-0', pressed: false }),
  Object.freeze({ kind: 'axis', control: 'axis-0', value: 1 }),
  Object.freeze({ kind: 'axis', control: 'axis-5', value: -0.5 }),
  Object.freeze({ kind: 'axis', control: 'axis-0', value: 0 }),
  Object.freeze({ kind: 'axis', control: 'axis-5', value: 0 }),
]);

async function loadBindings(installRoot, importer = (specifier) => import(specifier)) {
  return importer(pathToFileURL(path.join(installRoot, 'index.mjs')).href);
}

/** Probe real Linux uinput prerequisites without opening or mutating a device. */
export async function probeLinuxUinput({
  installRoot = path.resolve('out/native-linux/install'),
  devicePath = '/dev/uinput',
  accessImpl = access,
  importer = (specifier) => import(specifier),
} = {}) {
  const normalizedRoot = absolute(installRoot, 'installRoot');
  try {
    await accessImpl(devicePath, constants.R_OK | constants.W_OK);
  } catch {
    return Object.freeze({
      status: 'unavailable',
      reason: 'Linux uinput device is not readable and writable',
      devicePath,
      installRoot: normalizedRoot,
    });
  }
  try {
    await loadBindings(normalizedRoot, importer);
  } catch (error) {
    return Object.freeze({
      status: 'unavailable',
      reason: `installed Linux native package is unavailable: ${error.message}`,
      devicePath,
      installRoot: normalizedRoot,
    });
  }
  return Object.freeze({ status: 'ready', reason: null, devicePath, installRoot: normalizedRoot });
}

/** Run an explicit real-device input/force-feedback verification when requested. */
export async function verifyLinuxUinput({
  installRoot = path.resolve('out/native-linux/install'),
  devicePath = '/dev/uinput',
  accessImpl = access,
  importer = (specifier) => import(specifier),
  execute = false,
  rumble = false,
  timeoutMs = 1000,
  environment = process.env,
} = {}) {
  const probe = await probeLinuxUinput({ installRoot, devicePath, accessImpl, importer });
  if (probe.status !== 'ready' || !execute)
    return Object.freeze({
      ...probe,
      mode: execute ? 'input-sequence' : 'probe-only',
      input: 'not-run',
      forceFeedback: 'not-run',
    });
  let bindings;
  try {
    const module = await loadBindings(probe.installRoot, importer);
    if (typeof module.createBindings !== 'function')
      throw new Error('Linux native package must export createBindings');
    bindings = await module.createBindings({ environment });
    if (!bindings?.capabilities?.gamepad || typeof bindings.input?.execute !== 'function')
      throw new Error('uinput virtual gamepad capability is unavailable');
    for (const operation of SEQUENCE) await bindings.input.execute(operation);
    let forceFeedback = 'not-requested';
    if (rumble) {
      if (!bindings.capabilities.rumble || typeof bindings.input.readRumbleEvents !== 'function')
        throw new Error('force-feedback capability is unavailable');
      await bindings.input.execute({
        kind: 'rumble',
        strongMagnitude: 0.5,
        weakMagnitude: 0.25,
        durationMs: 80,
      });
      const deadline = Date.now() + boundedTimeout(timeoutMs);
      let observed = false;
      while (Date.now() < deadline) {
        if (
          bindings.input
            .readRumbleEvents()
            .some((event) => event.strongMagnitude > 0 || event.weakMagnitude > 0)
        ) {
          observed = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      if (!observed)
        throw new Error('force-feedback effect was not observed through the uinput reader');
      forceFeedback = 'verified';
    }
    return Object.freeze({
      ...probe,
      mode: rumble ? 'input-and-force-feedback' : 'input-sequence',
      input: 'verified',
      forceFeedback,
    });
  } catch (error) {
    return Object.freeze({
      ...probe,
      status: 'unavailable',
      reason: error.message,
      mode: rumble ? 'input-and-force-feedback' : 'input-sequence',
      input: 'failed',
      forceFeedback: rumble ? 'failed' : 'not-requested',
    });
  } finally {
    await bindings?.close?.();
  }
}

function argument(argv, name) {
  const index = argv.indexOf(name);
  return index < 0 ? '' : argv[index + 1];
}
async function writeReport(file, report) {
  if (!file) return;
  const target = path.resolve(file);
  if (target === path.parse(target).root)
    throw new TypeError('report file cannot be the filesystem root');
  await writeFile(target, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
}
if (path.resolve(process.argv[1] || '') === path.resolve(new URL(import.meta.url).pathname)) {
  try {
    const argv = process.argv.slice(2);
    const result = await verifyLinuxUinput({
      installRoot: argument(argv, '--install-root') || undefined,
      devicePath: argument(argv, '--device') || undefined,
      execute: argv.includes('--execute'),
      rumble: argv.includes('--rumble'),
      timeoutMs: argument(argv, '--timeout-ms') || undefined,
    });
    await writeReport(argument(argv, '--report-file'), result);
    console.log(JSON.stringify(result));
    if (result.status !== 'ready') process.exitCode = 2;
  } catch (error) {
    console.error(`Linux uinput verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
