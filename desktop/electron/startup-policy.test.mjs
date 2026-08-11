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

const defaults = Object.freeze({
  hardwareAcceleration: true,
  gpuPreference: 'Automatic',
  processModel: 'Default',
  crashReports: false,
  verboseLogs: false,
  logRetention: '7 days',
});

test('Electron startup policy defaults to hardware acceleration and rejects non-boolean input', () => {
  assert.deepEqual(normalizeElectronStartupPolicy(), defaults);
  assert.deepEqual(normalizeElectronStartupPolicy({ hardwareAcceleration: 'false' }), defaults);
  assert.deepEqual(normalizeElectronStartupPolicy({ hardwareAcceleration: false }), {
    ...defaults,
    hardwareAcceleration: false,
  });
});

test('Electron startup policy bounds GPU preference and process model choices', () => {
  assert.deepEqual(normalizeElectronStartupPolicy({ gpuPreference: 'unsupported' }), defaults);
  assert.deepEqual(normalizeElectronStartupPolicy({ processModel: 'unsupported' }), defaults);
  assert.deepEqual(normalizeElectronStartupPolicy({ gpuPreference: 'Power saving GPU' }), {
    ...defaults,
    gpuPreference: 'Power saving GPU',
  });
  assert.deepEqual(normalizeElectronStartupPolicy({ gpuPreference: 'High performance GPU' }), {
    ...defaults,
    gpuPreference: 'High performance GPU',
  });
  assert.deepEqual(normalizeElectronStartupPolicy({ processModel: 'Maximum isolation' }), {
    ...defaults,
    processModel: 'Maximum isolation',
  });
  assert.deepEqual(normalizeElectronStartupPolicy({ processModel: 'Low memory' }), {
    ...defaults,
    processModel: 'Low memory',
  });
});

test('Electron startup policy persists atomically and malformed files fail safe', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'spartan-startup-policy-'));
  const filePath = path.join(directory, 'policy.json');
  try {
    await persistElectronStartupPolicy(filePath, {
      hardwareAcceleration: false,
      gpuPreference: 'High performance GPU',
      processModel: 'Maximum isolation',
    });
    assert.deepEqual(readElectronStartupPolicy(filePath), {
      ...defaults,
      hardwareAcceleration: false,
      gpuPreference: 'High performance GPU',
      processModel: 'Maximum isolation',
    });
    assert.deepEqual(JSON.parse(await readFile(filePath, 'utf8')), {
      hardwareAcceleration: false,
      gpuPreference: 'High performance GPU',
      processModel: 'Maximum isolation',
      crashReports: false,
      verboseLogs: false,
      logRetention: '7 days',
    });
    await writeFile(filePath, '{invalid');
    assert.deepEqual(readElectronStartupPolicy(filePath), defaults);
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
    assert.deepEqual(readElectronStartupPolicy(filePath), defaults);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('Electron startup policy applies Chromium switches before readiness', () => {
  const switches = [];
  const app = {
    commandLine: { appendSwitch: (name) => switches.push(name) },
    disableHardwareAcceleration: () => switches.push('disable-hardware-acceleration'),
  };
  assert.deepEqual(
    applyElectronStartupPolicy(app, {
      hardwareAcceleration: false,
      gpuPreference: 'High performance GPU',
      processModel: 'Maximum isolation',
    }),
    {
      ...defaults,
      hardwareAcceleration: false,
      gpuPreference: 'High performance GPU',
      processModel: 'Maximum isolation',
    },
  );
  assert.deepEqual(switches, [
    'disable-hardware-acceleration',
    'force-high-performance-gpu',
    'site-per-process',
  ]);
});

test('Electron startup policy reports restart changes across every startup choice', () => {
  assert.deepEqual(
    describeElectronStartupPolicy(
      {
        hardwareAcceleration: false,
        gpuPreference: 'Power saving GPU',
        processModel: 'Low memory',
      },
      { hardwareAcceleration: true, gpuPreference: 'Automatic', processModel: 'Default' },
    ),
    {
      ...defaults,
      hardwareAcceleration: false,
      gpuPreference: 'Power saving GPU',
      processModel: 'Low memory',
      requiresRestart: true,
    },
  );
  assert.deepEqual(describeElectronStartupPolicy({ gpuPreference: 'High performance GPU' }, {}), {
    ...defaults,
    gpuPreference: 'High performance GPU',
    requiresRestart: true,
  });
  assert.deepEqual(describeElectronStartupPolicy({ processModel: 'Maximum isolation' }, {}), {
    ...defaults,
    processModel: 'Maximum isolation',
    requiresRestart: true,
  });
  assert.deepEqual(describeElectronStartupPolicy({}, {}), {
    ...defaults,
    requiresRestart: false,
  });
});
