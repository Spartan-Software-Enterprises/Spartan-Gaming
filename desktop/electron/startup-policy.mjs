import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const writeQueues = new Map();

export function normalizeElectronStartupPolicy(settings = {}) {
  return Object.freeze({
    hardwareAcceleration: settings?.hardwareAcceleration !== false,
    gpuPreference: ['Automatic', 'Power saving GPU', 'High performance GPU'].includes(
      settings?.gpuPreference,
    )
      ? settings.gpuPreference
      : 'Automatic',
    processModel: ['Default', 'Maximum isolation', 'Low memory'].includes(settings?.processModel)
      ? settings.processModel
      : 'Default',
    crashReports: settings?.crashReports === true,
    verboseLogs: settings?.verboseLogs === true,
    logRetention: ['1 day', '7 days', '30 days', 'Until manually removed'].includes(
      settings?.logRetention,
    )
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
  if (!normalized.hardwareAcceleration || normalized.gpuPreference === 'Power saving GPU')
    app.disableHardwareAcceleration();
  if (normalized.processModel === 'Maximum isolation')
    app.commandLine.appendSwitch('--site-per-process');
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
