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
    gpuPreference: 'Automatic',
    processModel: 'Default',
    crashReports: false,
    verboseLogs: false,
    logRetention: '7 days',
  });
  assert.deepEqual(normalizeElectronStartupPolicy({ hardwareAcceleration: 'false' }), {
    hardwareAcceleration: true,
    gpuPreference: 'Automatic',
    processModel: 'Default',
    crashReports: false,
    verboseLogs: false,
    logRetention: '7 days',
  });
  assert.deepEqual(normalizeElectronStartupPolicy({ hardwareAcceleration: false }), {
    hardwareAcceleration: false,
    gpuPreference: 'Automatic',
    processModel: 'Default',
    crashReports: false,
    verboseLogs: false,
    logRetention: '7 days',
  });
});

test('Electron startup policy normalizes bounded GPU preference and process model options', () => {
  assert.deepEqual(normalizeElectronStartupPolicy({ gpuPreference: 'Power saving GPU' }), {
    hardwareAcceleration: true,
    gpuPreference: 'Power saving GPU',
    processModel: 'Default',
    crashReports: false,
    verboseLogs: false,
    logRetention: '7 days',
  });
  assert.deepEqual(normalizeElectronStartupPolicy({ gpuPreference: 'High performance GPU' }), {
    hardwareAcceleration: true,
    gpuPreference: 'High performance GPU',
    processModel: 'Default',
    crashReports: false,
    verboseLogs: false,
    logRetention: '7 days',
  });
  assert.deepEqual(normalizeElectronStartupPolicy({ gpuPreference: 'invalid' }), {
    hardwareAcceleration: true,
    gpuPreference: 'Automatic',
    processModel: 'Default',
    crashReports: false,
    verboseLogs: false,
    logRetention: '7 days',
  });
  assert.deepEqual(normalizeElectronStartupPolicy({ processModel: 'Maximum isolation' }), {
    hardwareAcceleration: true,
    gpuPreference: 'Automatic',
    processModel: 'Maximum isolation',
    crashReports: false,
    verboseLogs: false,
    logRetention: '7 days',
  });
  assert.deepEqual(normalizeElectronStartupPolicy({ processModel: 'Low memory' }), {
    hardwareAcceleration: true,
    gpuPreference: 'Automatic',
    processModel: 'Low memory',
    crashReports: false,
    verboseLogs: false,
    logRetention: '7 days',
  });
  assert.deepEqual(normalizeElectronStartupPolicy({ processModel: 'invalid' }), {
    hardwareAcceleration: true,
    gpuPreference: 'Automatic',
    processModel: 'Default',
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
      gpuPreference: 'Automatic',
      processModel: 'Default',
      crashReports: false,
      verboseLogs: false,
      logRetention: '7 days',
    });
    assert.deepEqual(JSON.parse(await readFile(filePath, 'utf8')), {
      hardwareAcceleration: false,
      gpuPreference: 'Automatic',
      processModel: 'Default',
      crashReports: false,
      verboseLogs: false,
      logRetention: '7 days',
    });
    await writeFile(filePath, '{invalid');
    assert.deepEqual(readElectronStartupPolicy(filePath), {
      hardwareAcceleration: true,
      gpuPreference: 'Automatic',
      processModel: 'Default',
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
      gpuPreference: 'Automatic',
      processModel: 'Default',
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
  const switches = [];
  assert.deepEqual(
    applyElectronStartupPolicy(
      {
        disableHardwareAcceleration: () => (disabled += 1),
        commandLine: { appendSwitch: (name) => switches.push(name) },
      },
      { hardwareAcceleration: false },
    ),
    {
      hardwareAcceleration: false,
      gpuPreference: 'Automatic',
      processModel: 'Default',
      crashReports: false,
      verboseLogs: false,
      logRetention: '7 days',
    },
  );
  assert.equal(disabled, 1);
  assert.deepEqual(
    applyElectronStartupPolicy(
      {
        disableHardwareAcceleration: () => (disabled += 1),
        commandLine: { appendSwitch: (name) => switches.push(name) },
      },
      { gpuPreference: 'Power saving GPU' },
    ),
    {
      hardwareAcceleration: true,
      gpuPreference: 'Power saving GPU',
      processModel: 'Default',
      crashReports: false,
      verboseLogs: false,
      logRetention: '7 days',
    },
  );
  assert.equal(disabled, 2);
  assert.deepEqual(switches, []);
  assert.deepEqual(
    applyElectronStartupPolicy(
      {
        disableHardwareAcceleration: () => {},
        commandLine: { appendSwitch: (name) => switches.push(name) },
      },
      { processModel: 'Maximum isolation' },
    ),
    {
      hardwareAcceleration: true,
      gpuPreference: 'Automatic',
      processModel: 'Maximum isolation',
      crashReports: false,
      verboseLogs: false,
      logRetention: '7 days',
    },
  );
  assert.deepEqual(switches, ['--site-per-process']);
  assert.deepEqual(
    describeElectronStartupPolicy({ hardwareAcceleration: false }, { hardwareAcceleration: true }),
    {
      hardwareAcceleration: false,
      gpuPreference: 'Automatic',
      processModel: 'Default',
      crashReports: false,
      verboseLogs: false,
      logRetention: '7 days',
      requiresRestart: true,
    },
  );
  assert.deepEqual(
    describeElectronStartupPolicy(
      { gpuPreference: 'Power saving GPU' },
      { gpuPreference: 'Automatic' },
    ),
    {
      hardwareAcceleration: true,
      gpuPreference: 'Power saving GPU',
      processModel: 'Default',
      crashReports: false,
      verboseLogs: false,
      logRetention: '7 days',
      requiresRestart: true,
    },
  );
  assert.deepEqual(
    describeElectronStartupPolicy(
      { processModel: 'Maximum isolation' },
      { processModel: 'Default' },
    ),
    {
      hardwareAcceleration: true,
      gpuPreference: 'Automatic',
      processModel: 'Maximum isolation',
      crashReports: false,
      verboseLogs: false,
      logRetention: '7 days',
      requiresRestart: true,
    },
  );
  assert.deepEqual(describeElectronStartupPolicy({}, {}), {
    hardwareAcceleration: true,
    gpuPreference: 'Automatic',
    processModel: 'Default',
    crashReports: false,
    verboseLogs: false,
    logRetention: '7 days',
    requiresRestart: false,
  });
});
