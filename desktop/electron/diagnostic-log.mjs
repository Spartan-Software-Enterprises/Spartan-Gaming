import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MAX_ENTRIES = 500;
const MAX_TEXT_LENGTH = 512;
const RETENTION_DAYS = Object.freeze({
  '1 day': 1,
  '7 days': 7,
  '30 days': 30,
  'Until manually removed': null,
});
const writeQueues = new Map();

function boundedText(value, fallback = 'unknown') {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, MAX_TEXT_LENGTH) || fallback;
}

export function redactDiagnosticText(value) {
  return boundedText(value)
    .replace(/\b(?:https?|wss?):\/\/[^\s"'<>]+/giu, '[redacted-url]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu, '[redacted-email]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/gu, '[redacted-address]')
    .replace(/(?:\/home\/|\/Users\/|\/data\/data\/)[^\s"'<>]+/gu, '[redacted-path]')
    .replace(/\bauthorization(?:\s*[:=]\s*|\s+)[^\r\n]*/giu, 'Authorization=[redacted]')
    .replace(/\b(token|password|secret|cookie|session)[\s:=]+[^\s,;]+/giu, '$1=[redacted]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/giu, 'Bearer [redacted]');
}

export function normalizeElectronDiagnosticsPolicy(settings = {}) {
  const logRetention = Object.hasOwn(RETENTION_DAYS, settings?.logRetention)
    ? settings.logRetention
    : '7 days';
  return Object.freeze({
    crashReports: settings?.crashReports === true,
    verboseLogs: settings?.verboseLogs === true,
    logRetention,
  });
}

function normalizeExitCode(value) {
  return Number.isSafeInteger(value) ? Math.max(-2147483648, Math.min(2147483647, value)) : null;
}

export function createElectronDiagnosticEntry(type, details = {}, { now = Date.now } = {}) {
  const timestamp = new Date(now()).toISOString();
  if (type === 'renderer-crash')
    return Object.freeze({
      timestamp,
      type,
      scope: boundedText(details.scope, 'application'),
      reason: boundedText(details.reason),
      exitCode: normalizeExitCode(details.exitCode),
    });
  if (type === 'child-process-crash')
    return Object.freeze({
      timestamp,
      type,
      processType: boundedText(details.type ?? details.processType),
      reason: boundedText(details.reason),
      exitCode: normalizeExitCode(details.exitCode),
      serviceName: boundedText(details.serviceName, '').slice(0, 80),
    });
  if (type === 'console')
    return Object.freeze({
      timestamp,
      type,
      level: boundedText(details.level, 'info').slice(0, 16),
      message: redactDiagnosticText(details.message),
      lineNumber: Number.isSafeInteger(details.lineNumber)
        ? Math.max(0, Math.min(2147483647, details.lineNumber))
        : 0,
    });
  throw new TypeError('unsupported Electron diagnostic event');
}

export function shouldRecordProcessFailure(reason) {
  return ['abnormal-exit', 'crashed', 'oom', 'launch-failed', 'integrity-failure'].includes(reason);
}

export function normalizeElectronConsoleMessage(eventOrDetails, level, message, lineNumber) {
  if (eventOrDetails && typeof eventOrDetails.message === 'string')
    return Object.freeze({
      level: eventOrDetails.level,
      message: eventOrDetails.message,
      lineNumber: eventOrDetails.lineNumber,
    });
  return Object.freeze({
    level: ['verbose', 'info', 'warning', 'error'][level] || 'info',
    message,
    lineNumber,
  });
}

function normalizeStoredEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const timestamp = Date.parse(entry.timestamp);
  if (!Number.isFinite(timestamp)) return null;
  try {
    return createElectronDiagnosticEntry(entry.type, entry, {
      now: () => timestamp,
    });
  } catch {
    return null;
  }
}

export function readElectronDiagnosticLog(filePath, { read = readFileSync } = {}) {
  try {
    const parsed = JSON.parse(read(filePath, 'utf8'));
    if (!Array.isArray(parsed)) return Object.freeze([]);
    return Object.freeze(parsed.map(normalizeStoredEntry).filter(Boolean).slice(-MAX_ENTRIES));
  } catch {
    return Object.freeze([]);
  }
}

function retainEntries(entries, policy, now, limit = MAX_ENTRIES) {
  const days = RETENTION_DAYS[policy.logRetention];
  const cutoff = days === null ? -Infinity : now - days * 24 * 60 * 60 * 1000;
  return entries.filter((entry) => Date.parse(entry.timestamp) >= cutoff).slice(-limit);
}

function queueDiagnosticOperation(filePath, task) {
  const previous = writeQueues.get(filePath) || Promise.resolve();
  const operation = previous.catch(() => {}).then(task);
  writeQueues.set(filePath, operation);
  const cleanup = () => {
    if (writeQueues.get(filePath) === operation) writeQueues.delete(filePath);
  };
  void operation.then(cleanup, cleanup);
  return operation;
}

async function writeEntriesAtomically(
  filePath,
  entries,
  { makeDirectory, write, move, remove, createTemporaryId },
) {
  await makeDirectory(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${createTemporaryId()}.tmp`;
  try {
    await write(temporaryPath, `${JSON.stringify(entries, null, 2)}\n`, { mode: 0o600 });
    await move(temporaryPath, filePath);
  } finally {
    await remove(temporaryPath, { force: true }).catch(() => {});
  }
}

export async function appendElectronDiagnosticEntry(
  filePath,
  policyInput,
  entry,
  {
    now = Date.now,
    makeDirectory = mkdir,
    write = writeFile,
    move = rename,
    remove = rm,
    createTemporaryId = randomUUID,
  } = {},
) {
  const policy = normalizeElectronDiagnosticsPolicy(policyInput);
  if (entry?.type === 'console' ? !policy.verboseLogs : !policy.crashReports) return false;
  const normalizedEntry = normalizeStoredEntry(entry);
  if (!normalizedEntry) throw new TypeError('invalid Electron diagnostic entry');
  return queueDiagnosticOperation(filePath, async () => {
    const entries = retainEntries(
      readElectronDiagnosticLog(filePath),
      policy,
      now(),
      MAX_ENTRIES - 1,
    );
    await writeEntriesAtomically(filePath, [...entries, normalizedEntry], {
      makeDirectory,
      write,
      move,
      remove,
      createTemporaryId,
    });
    return true;
  });
}

export async function clearElectronDiagnosticLog(filePath, { remove = rm } = {}) {
  return queueDiagnosticOperation(filePath, async () => {
    await remove(filePath, { force: true });
    return true;
  });
}

export async function pruneElectronDiagnosticLog(
  filePath,
  policyInput,
  {
    now = Date.now,
    makeDirectory = mkdir,
    write = writeFile,
    move = rename,
    remove = rm,
    createTemporaryId = randomUUID,
  } = {},
) {
  const policy = normalizeElectronDiagnosticsPolicy(policyInput);
  return queueDiagnosticOperation(filePath, async () => {
    const entries = retainEntries(readElectronDiagnosticLog(filePath), policy, now());
    if (!entries.length) {
      await remove(filePath, { force: true });
      return Object.freeze([]);
    }
    await writeEntriesAtomically(filePath, entries, {
      makeDirectory,
      write,
      move,
      remove,
      createTemporaryId,
    });
    return Object.freeze(entries);
  });
}

export async function flushElectronDiagnosticLog(filePath) {
  while (writeQueues.has(filePath)) await writeQueues.get(filePath).catch(() => {});
}

export function createElectronDiagnosticReport(
  filePath,
  {
    appVersion = 'unknown',
    platform = 'unknown',
    policy = {},
    createdAt = () => new Date().toISOString(),
  } = {},
) {
  const created = createdAt();
  const entries = retainEntries(
    readElectronDiagnosticLog(filePath),
    normalizeElectronDiagnosticsPolicy(policy),
    Date.parse(created),
  );
  return Object.freeze({
    format: 'spartan-gaming-electron-diagnostics',
    version: 1,
    createdAt: created,
    appVersion: boundedText(appVersion),
    platform: boundedText(platform),
    entries: Object.freeze(entries),
  });
}
