import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  assessRoadmapAcceptance,
  assessRoadmapAcceptanceWithSignedManifests,
} from './acceptance.mjs';

const repositoryRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const acceptanceWorkflow = fs.readFileSync(
  path.join(repositoryRoot, '.github/workflows/roadmap-acceptance.yml'),
  'utf8',
);

const production = {
  status: 'healthy',
  includeTurn: true,
  required: ['service', 'broker', 'turn-credential-service'],
  security: { credentials: 'external-secret-files', tls: 'configured' },
  primary: { status: 'healthy', broker: { status: 'ready', backend: 'redis' } },
  turn: { status: 'ready', network: { status: 'reachable', total: 1, reachable: 1 } },
};
const hardware = (platform) => ({
  kind: 'native-hardware-report',
  verification: 'runtime-exercise',
  platform,
  status: 'ready',
  package: { state: 'ready' },
  hardware: { state: 'ready' },
  execution: {
    state: 'ready',
    capture: 'verified',
    audio: 'verified',
    input: 'verified',
    haptics: 'verified',
  },
});
const virtual = (platform) => ({
  kind: 'virtual-gamepad-exercise',
  verification: 'signed-runtime-exercise',
  platform,
  status: 'ready',
  driver: { state: 'ready' },
  capabilities: { execute: true },
  exercise: { state: 'verified' },
});
const signed = (platform) => ({
  kind: 'signed-release-manifest',
  verification: 'webcrypto',
  platform,
  status: 'verified',
  signer: 'operator-key',
});
const steamOs = (target) => ({
  kind: 'steamos-hardware-report',
  verification: 'runtime-exercise',
  target,
  status: 'ready',
  checks: Object.fromEntries(
    [
      'gameMode',
      'desktopMode',
      'steamInput',
      'glyphs',
      'textEntry',
      'touchTrackpadGyroRear',
      'gamescope',
      'protonNative',
      'suspendResume',
      'battery',
      'externalDisplay',
    ].map((check) => [check, 'verified']),
  ),
});
const deviceVisual = (target) => ({
  kind: 'device-visual-report',
  verification: 'real-device-exercise',
  target,
  status: 'ready',
  packagedApplication: 'verified',
  screenshots: 'verified',
  interactions: 'verified',
});
const offline = (platform) => ({
  kind: 'offline-runtime-report',
  verification: 'network-disabled-exercise',
  platform,
  status: 'ready',
  networkDisabled: true,
  workflows: Object.fromEntries(
    ['coldStart', 'library', 'settings', 'controllers', 'installedRuntimes'].map((item) => [
      item,
      'verified',
    ]),
  ),
});
const provider = (providerId) => ({
  kind: 'provider-account-report',
  verification: 'real-service-exercise',
  providerId,
  status: 'ready',
  workflows: Object.fromEntries(
    ['signIn', 'signOut', 'restartPersistence', 'expiredSessionRecovery', 'accountSwitching'].map(
      (item) => [item, 'verified'],
    ),
  ),
});
const publicReleaseEvidence = {
  deviceVisualReports: [
    'win32',
    'darwin',
    'linux',
    'steam-deck',
    'android',
    'fire-tv',
    'chromeos',
    'roku',
  ].map(deviceVisual),
  inputCoverageReport: {
    kind: 'input-coverage-report',
    verification: 'real-device-exercise',
    status: 'ready',
    families: Object.fromEntries(
      ['keyboard', 'mouse', 'touch', 'remote', 'controllers'].map((item) => [item, 'verified']),
    ),
    workflows: Object.fromEntries(
      ['navigation', 'textEntry', 'gameplay', 'overlays', 'settings', 'recovery'].map((item) => [
        item,
        'verified',
      ]),
    ),
  },
  offlineReports: ['win32', 'darwin', 'linux', 'android'].map(offline),
  expectedProviderIds: ['cloud-one', 'cloud-two'],
  providerReports: ['cloud-one', 'cloud-two'].map(provider),
  releaseCandidateReport: {
    kind: 'release-candidate-report',
    verification: 'release-candidate-exercise',
    status: 'ready',
    commit: '0123456789abcdef',
    checks: Object.fromEntries(
      [
        'signedInstallers',
        'updateRollback',
        'accessibility',
        'crashRecovery',
        'performance',
        'longSessionStability',
        'capture',
        'audio',
        'input',
        'regression',
      ].map((item) => [item, 'verified']),
    ),
  },
};

test('roadmap acceptance stays incomplete and names every missing external gate', () => {
  const result = assessRoadmapAcceptance({
    productionReport: { status: 'healthy' },
    hardwareReports: [],
    virtualGamepadReports: [],
    signedPackageReports: [],
  });
  assert.equal(result.status, 'incomplete');
  assert.deepEqual(result.blockers, [
    'production-services',
    'native-hardware',
    'desktop-virtual-gamepads',
    'external-package-signing',
    'steam-os-hardware',
    'real-device-visuals',
    'physical-input-coverage',
    'offline-runtime',
    'provider-account-lifecycle',
    'release-candidate-qualification',
  ]);
});

test('roadmap acceptance does not accept an in-memory broker or unprobed TURN relay', () => {
  const report = {
    ...production,
    primary: { status: 'healthy', broker: { status: 'ready', backend: 'memory' } },
    turn: { status: 'ready' },
  };
  const result = assessRoadmapAcceptance({ productionReport: report });
  assert.equal(result.gates.find((gate) => gate.id === 'production-services').status, 'missing');
});

test('roadmap acceptance requires explicit TLS and external-secret evidence', () => {
  const report = {
    ...production,
    security: { credentials: 'inline', tls: 'loopback-development' },
  };
  const result = assessRoadmapAcceptance({ productionReport: report });
  assert.equal(result.gates.find((gate) => gate.id === 'production-services').status, 'missing');
});

test('roadmap acceptance rejects an unverifiable signed-package summary', () => {
  const result = assessRoadmapAcceptance({
    productionReport: production,
    signedPackageReports: [{ platform: 'linux', status: 'verified' }],
  });
  assert.deepEqual(result.gates.find((gate) => gate.id === 'external-package-signing').missing, [
    'win32',
    'darwin',
    'linux',
  ]);
});

test('roadmap acceptance rejects capability-only hardware and driver observations', () => {
  const hardwareOnly = { ...hardware('linux'), verification: 'capability-observation' };
  const driverOnly = { ...virtual('win32'), verification: 'signed-runtime-observation' };
  const result = assessRoadmapAcceptance({
    productionReport: production,
    hardwareReports: [hardwareOnly],
    virtualGamepadReports: [driverOnly],
  });
  assert.deepEqual(result.gates.find((gate) => gate.id === 'native-hardware').missing, [
    'win32',
    'darwin',
    'linux',
  ]);
  assert.deepEqual(result.gates.find((gate) => gate.id === 'desktop-virtual-gamepads').missing, [
    'win32',
    'darwin',
  ]);
});

test('roadmap acceptance fails closed on duplicate evidence identities', () => {
  assert.throws(
    () =>
      assessRoadmapAcceptance({
        productionReport: production,
        hardwareReports: [hardware('linux'), hardware('linux')],
      }),
    /hardware reports contains duplicate evidence for linux/,
  );
  assert.throws(
    () =>
      assessRoadmapAcceptance({
        productionReport: production,
        virtualGamepadReports: [virtual('win32'), virtual('windows')],
      }),
    /virtual-gamepad reports contains duplicate evidence for win32/,
  );
  assert.throws(
    () =>
      assessRoadmapAcceptance({
        productionReport: production,
        signedPackageReports: [signed('darwin'), signed('macos')],
      }),
    /signed-package reports contains duplicate evidence for darwin/,
  );
  assert.throws(
    () =>
      assessRoadmapAcceptance({
        productionReport: production,
        steamOsReports: [steamOs('steam-deck'), steamOs('deck')],
      }),
    /SteamOS reports contains duplicate evidence for steam-deck/,
  );
});

test('roadmap acceptance completes only with all production, hardware, driver, and signing evidence', () => {
  const result = assessRoadmapAcceptance({
    ...publicReleaseEvidence,
    productionReport: production,
    hardwareReports: [hardware('linux'), hardware('win32'), hardware('darwin')],
    virtualGamepadReports: [virtual('win32'), virtual('darwin')],
    signedPackageReports: [signed('linux'), signed('win32'), signed('darwin')],
    steamOsReports: [steamOs('steam-deck'), steamOs('steam-machine')],
  });
  assert.equal(result.status, 'complete');
  assert.deepEqual(result.blockers, []);
  assert.ok(result.gates.every((gate) => gate.status === 'verified'));
});

test('roadmap acceptance requires Linux hardware readiness and desktop injection exercises', () => {
  const linux = hardware('linux');
  linux.hardware = { state: 'unavailable' };
  const result = assessRoadmapAcceptance({
    ...publicReleaseEvidence,
    productionReport: production,
    hardwareReports: [linux, hardware('win32'), hardware('darwin')],
    virtualGamepadReports: [virtual('win32'), virtual('darwin')],
    signedPackageReports: [signed('linux'), signed('win32'), signed('darwin')],
    steamOsReports: [steamOs('steam-deck'), steamOs('steam-machine')],
  });
  assert.equal(result.status, 'incomplete');
  assert.deepEqual(result.gates.find((gate) => gate.id === 'native-hardware').missing, ['linux']);
});

test('roadmap acceptance verifies supplied signed manifests before accepting package custody', async () => {
  const calls = [];
  const result = await assessRoadmapAcceptanceWithSignedManifests({
    ...publicReleaseEvidence,
    productionReport: production,
    hardwareReports: [hardware('linux'), hardware('win32'), hardware('darwin')],
    virtualGamepadReports: [virtual('win32'), virtual('darwin')],
    steamOsReports: [steamOs('steam-deck'), steamOs('steam-machine')],
    signedManifestPaths: ['/release/linux.json', '/release/windows.json', '/release/macos.json'],
    publicKeyJwk: { kty: 'EC' },
    verifyManifest: async (input) => {
      calls.push(input);
      return signed(
        input.manifestPath.includes('linux')
          ? 'linux'
          : input.manifestPath.includes('windows')
            ? 'win32'
            : 'darwin',
      );
    },
  });
  assert.equal(result.status, 'complete');
  assert.equal(calls.length, 3);
  assert.equal(calls[0].publicKeyJwk.kty, 'EC');
});

test('roadmap acceptance rejects signed manifests without a public key', async () => {
  await assert.rejects(
    () =>
      assessRoadmapAcceptanceWithSignedManifests({
        productionReport: production,
        signedManifestPaths: ['/release/linux.json'],
      }),
    /publicKeyJwk is required/,
  );
});

test('roadmap acceptance requires both physical SteamOS targets and every handheld check', () => {
  const deck = steamOs('steam-deck');
  deck.checks.protonNative = 'missing';
  const result = assessRoadmapAcceptance({
    productionReport: production,
    steamOsReports: [deck, steamOs('steam-machine')],
  });
  assert.deepEqual(result.gates.find((gate) => gate.id === 'steam-os-hardware').missing, [
    'steam-deck',
  ]);
});

test('roadmap acceptance fails closed for incomplete public-release evidence', () => {
  const visuals = publicReleaseEvidence.deviceVisualReports.filter(
    (report) => report.target !== 'fire-tv',
  );
  const offlineReports = publicReleaseEvidence.offlineReports.map((report) =>
    report.platform === 'android'
      ? { ...report, workflows: { ...report.workflows, installedRuntimes: 'missing' } }
      : report,
  );
  const result = assessRoadmapAcceptance({
    ...publicReleaseEvidence,
    deviceVisualReports: visuals,
    offlineReports,
    providerReports: [provider('cloud-one')],
    releaseCandidateReport: {
      ...publicReleaseEvidence.releaseCandidateReport,
      checks: { ...publicReleaseEvidence.releaseCandidateReport.checks, accessibility: 'missing' },
    },
    productionReport: production,
  });
  assert.deepEqual(result.gates.find((gate) => gate.id === 'real-device-visuals').missing, [
    'fire-tv',
  ]);
  assert.deepEqual(result.gates.find((gate) => gate.id === 'offline-runtime').missing, ['android']);
  assert.deepEqual(result.gates.find((gate) => gate.id === 'provider-account-lifecycle').missing, [
    'cloud-two',
  ]);
  assert.equal(
    result.gates.find((gate) => gate.id === 'release-candidate-qualification').status,
    'missing',
  );
});

test('roadmap acceptance workflow requires the complete runner-local evidence layout', () => {
  assert.match(acceptanceWorkflow, /workflow_dispatch:/);
  assert.match(acceptanceWorkflow, /runs-on: \$\{\{ inputs\.runner_label \}\}/);
  assert.match(acceptanceWorkflow, /production\/rollout\.json/);
  assert.match(acceptanceWorkflow, /hardware\/linux\.json/);
  assert.match(acceptanceWorkflow, /hardware\/win32\.json/);
  assert.match(acceptanceWorkflow, /hardware\/darwin\.json/);
  assert.match(acceptanceWorkflow, /steam-os\/steam-deck\.json/);
  assert.match(acceptanceWorkflow, /steam-os\/steam-machine\.json/);
  assert.match(acceptanceWorkflow, /--steamos-report/);
  assert.match(acceptanceWorkflow, /virtual-gamepad\/win32\.json/);
  assert.match(acceptanceWorkflow, /virtual-gamepad\/darwin\.json/);
  assert.match(acceptanceWorkflow, /device-visual\/fire-tv\.json/);
  assert.match(acceptanceWorkflow, /offline\/android\.json/);
  assert.match(acceptanceWorkflow, /input\/coverage\.json/);
  assert.match(acceptanceWorkflow, /release-candidate\/qualification\.json/);
  assert.match(acceptanceWorkflow, /--provider-catalog providers\/catalog\.json/);
  assert.match(acceptanceWorkflow, /--signed-manifest/);
  assert.match(acceptanceWorkflow, /--public-key-file/);
  assert.match(acceptanceWorkflow, /actions\/upload-artifact@v7/);
  assert.doesNotMatch(acceptanceWorkflow, /SPARTAN_.*SECRET\s*:/);
});
