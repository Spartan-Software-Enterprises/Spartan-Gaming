import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {assessRoadmapAcceptance, assessRoadmapAcceptanceWithSignedManifests} from './acceptance.mjs';

const repositoryRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const acceptanceWorkflow = fs.readFileSync(path.join(repositoryRoot, '.github/workflows/roadmap-acceptance.yml'), 'utf8');

const production = {status: 'healthy', includeTurn: true, required: ['service', 'broker', 'turn-credential-service'], security: {credentials: 'external-secret-files', tls: 'configured'}, primary: {status: 'healthy', broker: {status: 'ready', backend: 'redis'}}, turn: {status: 'ready', network: {status: 'reachable', total: 1, reachable: 1}}};
const hardware = platform => ({kind: 'native-hardware-report', verification: 'runtime-exercise', platform, status: 'ready', package: {state: 'ready'}, hardware: {state: 'ready'}, execution: {state: 'ready', capture: 'verified', audio: 'verified', input: 'verified', haptics: 'verified'}});
const virtual = platform => ({kind: 'virtual-gamepad-exercise', verification: 'signed-runtime-exercise', platform, status: 'ready', driver: {state: 'ready'}, capabilities: {execute: true}, exercise: {state: 'verified'}});
const signed = platform => ({kind: 'signed-release-manifest', verification: 'webcrypto', platform, status: 'verified', signer: 'operator-key'});
const steamOs = target => ({kind: 'steamos-hardware-report', verification: 'runtime-exercise', target, status: 'ready', checks: Object.fromEntries(['gameMode', 'desktopMode', 'steamInput', 'glyphs', 'textEntry', 'touchTrackpadGyroRear', 'gamescope', 'protonNative', 'suspendResume', 'battery', 'externalDisplay'].map(check => [check, 'verified']))});

test('roadmap acceptance stays incomplete and names every missing external gate', () => {
  const result = assessRoadmapAcceptance({productionReport: {status: 'healthy'}, hardwareReports: [], virtualGamepadReports: [], signedPackageReports: []});
  assert.equal(result.status, 'incomplete'); assert.deepEqual(result.blockers, ['production-services', 'native-hardware', 'desktop-virtual-gamepads', 'external-package-signing', 'steam-os-hardware']);
});

test('roadmap acceptance does not accept an in-memory broker or unprobed TURN relay', () => {
  const report = {...production, primary: {status: 'healthy', broker: {status: 'ready', backend: 'memory'}}, turn: {status: 'ready'}};
  const result = assessRoadmapAcceptance({productionReport: report});
  assert.equal(result.gates.find(gate => gate.id === 'production-services').status, 'missing');
});

test('roadmap acceptance requires explicit TLS and external-secret evidence', () => {
  const report = {...production, security: {credentials: 'inline', tls: 'loopback-development'}};
  const result = assessRoadmapAcceptance({productionReport: report});
  assert.equal(result.gates.find(gate => gate.id === 'production-services').status, 'missing');
});

test('roadmap acceptance rejects an unverifiable signed-package summary', () => {
  const result = assessRoadmapAcceptance({productionReport: production, signedPackageReports: [{platform: 'linux', status: 'verified'}]});
  assert.deepEqual(result.gates.find(gate => gate.id === 'external-package-signing').missing, ['win32', 'darwin', 'linux']);
});

test('roadmap acceptance rejects capability-only hardware and driver observations', () => {
  const hardwareOnly = {...hardware('linux'), verification: 'capability-observation'};
  const driverOnly = {...virtual('win32'), verification: 'signed-runtime-observation'};
  const result = assessRoadmapAcceptance({productionReport: production, hardwareReports: [hardwareOnly], virtualGamepadReports: [driverOnly]});
  assert.deepEqual(result.gates.find(gate => gate.id === 'native-hardware').missing, ['win32', 'darwin', 'linux']);
  assert.deepEqual(result.gates.find(gate => gate.id === 'desktop-virtual-gamepads').missing, ['win32', 'darwin']);
});

test('roadmap acceptance completes only with all production, hardware, driver, and signing evidence', () => {
  const result = assessRoadmapAcceptance({productionReport: production, hardwareReports: [hardware('linux'), hardware('win32'), hardware('darwin')], virtualGamepadReports: [virtual('win32'), virtual('darwin')], signedPackageReports: [signed('linux'), signed('win32'), signed('darwin')], steamOsReports: [steamOs('steam-deck'), steamOs('steam-machine')]});
  assert.equal(result.status, 'complete'); assert.deepEqual(result.blockers, []); assert.ok(result.gates.every(gate => gate.status === 'verified'));
});

test('roadmap acceptance requires Linux hardware readiness and desktop injection exercises', () => {
  const linux = hardware('linux'); linux.hardware = {state: 'unavailable'};
  const result = assessRoadmapAcceptance({productionReport: production, hardwareReports: [linux, hardware('win32'), hardware('darwin')], virtualGamepadReports: [virtual('win32'), virtual('darwin')], signedPackageReports: [signed('linux'), signed('win32'), signed('darwin')], steamOsReports: [steamOs('steam-deck'), steamOs('steam-machine')]});
  assert.equal(result.status, 'incomplete'); assert.deepEqual(result.gates.find(gate => gate.id === 'native-hardware').missing, ['linux']);
});

test('roadmap acceptance verifies supplied signed manifests before accepting package custody', async () => {
  const calls = []; const result = await assessRoadmapAcceptanceWithSignedManifests({productionReport: production, hardwareReports: [hardware('linux'), hardware('win32'), hardware('darwin')], virtualGamepadReports: [virtual('win32'), virtual('darwin')], steamOsReports: [steamOs('steam-deck'), steamOs('steam-machine')], signedManifestPaths: ['/release/linux.json', '/release/windows.json', '/release/macos.json'], publicKeyJwk: {kty: 'EC'}, verifyManifest: async input => { calls.push(input); return signed(input.manifestPath.includes('linux') ? 'linux' : input.manifestPath.includes('windows') ? 'win32' : 'darwin'); }});
  assert.equal(result.status, 'complete'); assert.equal(calls.length, 3); assert.equal(calls[0].publicKeyJwk.kty, 'EC');
});

test('roadmap acceptance rejects signed manifests without a public key', async () => {
  await assert.rejects(() => assessRoadmapAcceptanceWithSignedManifests({productionReport: production, signedManifestPaths: ['/release/linux.json']}), /publicKeyJwk is required/);
});

test('roadmap acceptance requires both physical SteamOS targets and every handheld check', () => {
  const deck = steamOs('steam-deck'); deck.checks.protonNative = 'missing';
  const result = assessRoadmapAcceptance({productionReport: production, steamOsReports: [deck, steamOs('steam-machine')]});
  assert.deepEqual(result.gates.find(gate => gate.id === 'steam-os-hardware').missing, ['steam-deck']);
});

test('roadmap acceptance workflow requires the complete runner-local evidence layout', () => {
  assert.match(acceptanceWorkflow, /workflow_dispatch:/); assert.match(acceptanceWorkflow, /runs-on: \$\{\{ inputs\.runner_label \}\}/);
  assert.match(acceptanceWorkflow, /production\/rollout\.json/); assert.match(acceptanceWorkflow, /hardware\/linux\.json/); assert.match(acceptanceWorkflow, /hardware\/win32\.json/); assert.match(acceptanceWorkflow, /hardware\/darwin\.json/);
  assert.match(acceptanceWorkflow, /steam-os\/steam-deck\.json/); assert.match(acceptanceWorkflow, /steam-os\/steam-machine\.json/); assert.match(acceptanceWorkflow, /--steamos-report/); assert.match(acceptanceWorkflow, /virtual-gamepad\/win32\.json/); assert.match(acceptanceWorkflow, /virtual-gamepad\/darwin\.json/); assert.match(acceptanceWorkflow, /--signed-manifest/); assert.match(acceptanceWorkflow, /--public-key-file/); assert.match(acceptanceWorkflow, /actions\/upload-artifact@v7/);
  assert.doesNotMatch(acceptanceWorkflow, /SPARTAN_.*SECRET\s*:/);
});
