import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const writeQueues = new Map();

const GPU_PREFERENCE_OPTIONS = Object.freeze([
  'Automatic',
  'Power saving GPU',
  'High performance GPU',
]);
const PROCESS_MODEL_OPTIONS = Object.freeze(['Default', 'Maximum isolation', 'Low memory']);
const LOG_RETENTION_OPTIONS = Object.freeze([
  '1 day',
  '7 days',
  '30 days',
  'Until manually removed',
]);

/** Chromium command-line switches applied before the app becomes ready. */
const GPU_PREFERENCE_SWITCHES = Object.freeze({
  Automatic: null,
  'Power saving GPU': 'force-low-power-gpu',
  'High performance GPU': 'force-high-performance-gpu',
});
const PROCESS_MODEL_SWITCHES = Object.freeze({
  Default: null,
  'Maximum isolation': 'site-per-process',
  'Low memory': 'enable-low-end-device-mode',
});

export function normalizeElectronStartupPolicy(settings = {}) {
  return Object.freeze({
    hardwareAcceleration: settings?.hardwareAcceleration !== false,
    gpuPreference: GPU_PREFERENCE_OPTIONS.includes(settings?.gpuPreference)
      ? settings.gpuPreference
      : 'Automatic',
    processModel: PROCESS_MODEL_OPTIONS.includes(settings?.processModel)
      ? settings.processModel
      : 'Default',
    crashReports: settings?.crashReports === true,
    verboseLogs: settings?.verboseLogs === true,
    logRetention: LOG_RETENTION_OPTIONS.includes(settings?.logRetention)
      ? settings.logRetention
      : '7 days',
  });
}

export function readElectronStartupPolicy(filePath, { read = readFileSync } = {}) {
  try {
    return normalizeElectronStartupPolicy(JSON.parse(read(filePath, 'utf8')));
  } catch {
    return normalizeElectronStartupPolicy();
  }
}

export async function persistElectronStartupPolicy(
  filePath,
  settings,
  {
    makeDirectory = mkdir,
    write = writeFile,
    move = rename,
    remove = rm,
    createTemporaryId = randomUUID,
  } = {},
) {
  const policy = normalizeElectronStartupPolicy(settings);
  const previous = writeQueues.get(filePath) || Promise.resolve();
  const operation = previous
    .catch(() => {})
    .then(async () => {
      await makeDirectory(path.dirname(filePath), { recursive: true });
      const temporaryPath = `${filePath}.${process.pid}.${createTemporaryId()}.tmp`;
      try {
        await write(temporaryPath, `${JSON.stringify(policy, null, 2)}\n`, { mode: 0o600 });
        await move(temporaryPath, filePath);
        return policy;
      } finally {
        await remove(temporaryPath, { force: true }).catch(() => {});
      }
    });
  writeQueues.set(filePath, operation);
  try {
    return await operation;
  } finally {
    if (writeQueues.get(filePath) === operation) writeQueues.delete(filePath);
  }
}

export function applyElectronStartupPolicy(app, policy = normalizeElectronStartupPolicy()) {
  const normalized = normalizeElectronStartupPolicy(policy);
  if (!normalized.hardwareAcceleration) app.disableHardwareAcceleration();
  const gpuSwitch = GPU_PREFERENCE_SWITCHES[normalized.gpuPreference];
  if (gpuSwitch) app.commandLine.appendSwitch(gpuSwitch);
  const processSwitch = PROCESS_MODEL_SWITCHES[normalized.processModel];
  if (processSwitch) app.commandLine.appendSwitch(processSwitch);
  return normalized;
}

export function describeElectronStartupPolicy(saved, active) {
  const policy = normalizeElectronStartupPolicy(saved);
  const activePolicy = normalizeElectronStartupPolicy(active);
  return Object.freeze({
    ...policy,
    requiresRestart:
      policy.hardwareAcceleration !== activePolicy.hardwareAcceleration ||
      policy.gpuPreference !== activePolicy.gpuPreference ||
      policy.processModel !== activePolicy.processModel,
  });
}
