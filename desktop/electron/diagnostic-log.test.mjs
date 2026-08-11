import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  appendElectronDiagnosticEntry,
  clearElectronDiagnosticLog,
  createElectronDiagnosticEntry,
  createElectronDiagnosticReport,
  flushElectronDiagnosticLog,
  normalizeElectronDiagnosticsPolicy,
  pruneElectronDiagnosticLog,
  normalizeElectronConsoleMessage,
  readElectronDiagnosticLog,
  redactDiagnosticText,
  shouldRecordProcessFailure,
} from './diagnostic-log.mjs';

test('Electron diagnostic policy is opt-in and bounds retention', () => {
  assert.deepEqual(normalizeElectronDiagnosticsPolicy(), {
    crashReports: false,
    verboseLogs: false,
    logRetention: '7 days',
  });
  assert.deepEqual(
    normalizeElectronDiagnosticsPolicy({
      crashReports: true,
      verboseLogs: true,
      logRetention: 'Until manually removed',
    }),
    { crashReports: true, verboseLogs: true, logRetention: 'Until manually removed' },
  );
  assert.equal(
    normalizeElectronDiagnosticsPolicy({ logRetention: 'Forever' }).logRetention,
    '7 days',
  );
});

test('Electron diagnostics redact URLs and credential-shaped text', () => {
  assert.equal(
    redactDiagnosticText(
      'failed https://example.test/a?token=abc Authorization: Bearer-secret cookie=xyz user@example.test 192.168.1.2 /home/alex/game.log',
    ),
    'failed [redacted-url] Authorization=[redacted]',
  );
  assert.equal(
    redactDiagnosticText('cookie=xyz user@example.test 192.168.1.2 /home/alex/game.log'),
    'cookie=[redacted] [redacted-email] [redacted-address] [redacted-path]',
  );
  const authorization = redactDiagnosticText('Authorization: Bearer token-value');
  assert.equal(authorization, 'Authorization=[redacted]');
  assert.equal(authorization.includes('token-value'), false);
});

test('Electron diagnostic entries expose only bounded event fields', () => {
  assert.deepEqual(
    createElectronDiagnosticEntry(
      'renderer-crash',
      { scope: 'provider', reason: 'crashed', exitCode: 9, url: 'https://secret.test/' },
      { now: () => Date.parse('2026-08-11T12:00:00.000Z') },
    ),
    {
      timestamp: '2026-08-11T12:00:00.000Z',
      type: 'renderer-crash',
      scope: 'provider',
      reason: 'crashed',
      exitCode: 9,
    },
  );
  assert.equal(shouldRecordProcessFailure('crashed'), true);
  assert.equal(shouldRecordProcessFailure('clean-exit'), false);
  assert.equal(shouldRecordProcessFailure('killed'), false);
});

test('Electron console messages support current and deprecated event signatures', () => {
  assert.deepEqual(
    normalizeElectronConsoleMessage({ level: 'warning', message: 'current', lineNumber: 4 }),
    { level: 'warning', message: 'current', lineNumber: 4 },
  );
  assert.deepEqual(normalizeElectronConsoleMessage({}, 3, 'legacy', 5), {
    level: 'error',
    message: 'legacy',
    lineNumber: 5,
  });
  assert.equal(
    createElectronDiagnosticEntry('console', {
      message: 'bounded line',
      lineNumber: Number.MAX_SAFE_INTEGER,
    }).lineNumber,
    2147483647,
  );
});

test('Electron diagnostic log is opt-in, retained, exportable, and clearable', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'spartan-diagnostics-'));
  const filePath = path.join(directory, 'events.json');
  const now = Date.parse('2026-08-11T12:00:00.000Z');
  try {
    const crash = createElectronDiagnosticEntry(
      'renderer-crash',
      { reason: 'crashed', exitCode: 7 },
      { now: () => now },
    );
    assert.equal(await appendElectronDiagnosticEntry(filePath, {}, crash), false);
    assert.deepEqual(readElectronDiagnosticLog(filePath), []);
    await writeFile(
      filePath,
      JSON.stringify([
        createElectronDiagnosticEntry(
          'console',
          { message: 'old' },
          { now: () => now - 8 * 864e5 },
        ),
      ]),
    );
    await appendElectronDiagnosticEntry(
      filePath,
      { crashReports: true, logRetention: '7 days' },
      crash,
      { now: () => now },
    );
    assert.equal(readElectronDiagnosticLog(filePath).length, 1);
    const report = createElectronDiagnosticReport(filePath, {
      appVersion: '0.1.0',
      platform: 'linux',
      createdAt: () => '2026-08-11T12:01:00.000Z',
    });
    assert.equal(report.entries.length, 1);
    assert.equal(report.format, 'spartan-gaming-electron-diagnostics');
    assert.equal((await readFile(filePath, 'utf8')).includes('https://'), false);
    await clearElectronDiagnosticLog(filePath);
    assert.deepEqual(readElectronDiagnosticLog(filePath), []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('Electron diagnostic writes preserve request order', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'spartan-diagnostics-'));
  const filePath = path.join(directory, 'events.json');
  try {
    const policy = { verboseLogs: true };
    await Promise.all([
      appendElectronDiagnosticEntry(
        filePath,
        policy,
        createElectronDiagnosticEntry('console', { message: 'first' }),
      ),
      appendElectronDiagnosticEntry(
        filePath,
        policy,
        createElectronDiagnosticEntry('console', { message: 'second' }),
      ),
    ]);
    assert.deepEqual(
      readElectronDiagnosticLog(filePath).map((entry) => entry.message),
      ['first', 'second'],
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('Electron diagnostic prune and flush share the ordered file queue', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'spartan-diagnostics-'));
  const filePath = path.join(directory, 'events.json');
  const now = Date.parse('2026-08-11T12:00:00.000Z');
  try {
    await writeFile(
      filePath,
      JSON.stringify([
        createElectronDiagnosticEntry(
          'console',
          { message: 'expired' },
          { now: () => now - 2 * 864e5 },
        ),
      ]),
    );
    const append = appendElectronDiagnosticEntry(
      filePath,
      { verboseLogs: true, logRetention: '1 day' },
      createElectronDiagnosticEntry('console', { message: 'current' }, { now: () => now }),
      { now: () => now },
    );
    const prune = pruneElectronDiagnosticLog(
      filePath,
      { verboseLogs: false, logRetention: '1 day' },
      { now: () => now },
    );
    await flushElectronDiagnosticLog(filePath);
    await Promise.all([append, prune]);
    assert.deepEqual(
      readElectronDiagnosticLog(filePath).map((entry) => entry.message),
      ['current'],
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
