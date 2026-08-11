import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  applyElectronStartupPolicy,
  describeElectronStartupPolicy,
  normalizeElectronStartupPolicy,
  persistElectronStartupPolicy,
  readElectronStartupPolicy,
} from './startup-policy.mjs';

test('Electron startup policy defaults to hardware acceleration and rejects non-boolean input', () => {
  assert.deepEqual(normalizeElectronStartupPolicy(), {
    hardwareAcceleration: true,
    crashReports: false,
    verboseLogs: false,
    logRetention: '7 days',
  });
  assert.deepEqual(normalizeElectronStartupPolicy({ hardwareAcceleration: 'false' }), {
    hardwareAcceleration: true,
    crashReports: false,
    verboseLogs: false,
    logRetention: '7 days',
  });
  assert.deepEqual(normalizeElectronStartupPolicy({ hardwareAcceleration: false }), {
    hardwareAcceleration: false,
    crashReports: false,
    verboseLogs: false,
    logRetention: '7 days',
  });
});

test('Electron startup policy persists atomically and malformed files fail safe', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'spartan-startup-policy-'));
  const filePath = path.join(directory, 'policy.json');
  try {
    await persistElectronStartupPolicy(filePath, { hardwareAcceleration: false });
    assert.deepEqual(readElectronStartupPolicy(filePath), {
      hardwareAcceleration: false,
      crashReports: false,
      verboseLogs: false,
      logRetention: '7 days',
    });
    assert.deepEqual(JSON.parse(await readFile(filePath, 'utf8')), {
      hardwareAcceleration: false,
      crashReports: false,
      verboseLogs: false,
      logRetention: '7 days',
    });
    await writeFile(filePath, '{invalid');
    assert.deepEqual(readElectronStartupPolicy(filePath), {
      hardwareAcceleration: true,
      crashReports: false,
      verboseLogs: false,
      logRetention: '7 days',
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('Electron startup policy serializes concurrent writes in request order', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'spartan-startup-policy-'));
  const filePath = path.join(directory, 'policy.json');
  try {
    await Promise.all([
      persistElectronStartupPolicy(filePath, { hardwareAcceleration: false }),
      persistElectronStartupPolicy(filePath, { hardwareAcceleration: true }),
    ]);
    assert.deepEqual(readElectronStartupPolicy(filePath), {
      hardwareAcceleration: true,
      crashReports: false,
      verboseLogs: false,
      logRetention: '7 days',
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('Electron startup policy disables acceleration before readiness and reports restart changes', () => {
  let disabled = 0;
  assert.deepEqual(
    applyElectronStartupPolicy(
      { disableHardwareAcceleration: () => (disabled += 1) },
      { hardwareAcceleration: false },
    ),
    {
      hardwareAcceleration: false,
      crashReports: false,
      verboseLogs: false,
      logRetention: '7 days',
    },
  );
  assert.equal(disabled, 1);
  assert.deepEqual(
    describeElectronStartupPolicy({ hardwareAcceleration: false }, { hardwareAcceleration: true }),
    {
      hardwareAcceleration: false,
      crashReports: false,
      verboseLogs: false,
      logRetention: '7 days',
      requiresRestart: true,
    },
  );
  assert.deepEqual(describeElectronStartupPolicy({}, {}), {
    hardwareAcceleration: true,
    crashReports: false,
    verboseLogs: false,
    logRetention: '7 days',
    requiresRestart: false,
  });
});
