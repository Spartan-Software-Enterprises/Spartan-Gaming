import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const writeQueues = new Map();

export function normalizeElectronStartupPolicy(settings = {}) {
  return Object.freeze({ hardwareAcceleration: settings?.hardwareAcceleration !== false });
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
  return normalized;
}

export function describeElectronStartupPolicy(saved, active) {
  const policy = normalizeElectronStartupPolicy(saved);
  const activePolicy = normalizeElectronStartupPolicy(active);
  return Object.freeze({
    ...policy,
    requiresRestart: policy.hardwareAcceleration !== activePolicy.hardwareAcceleration,
  });
}
