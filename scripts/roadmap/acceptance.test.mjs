import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {assessRoadmapAcceptance, assessRoadmapAcceptanceWithSignedManifests} from './acceptance.mjs';

const repositoryRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const acceptanceWorkflow = fs.readFileSync(path.join(repositoryRoot, '.github/workflows/roadmap-acceptance.yml'), 'utf8');

const production = {status: 'healthy', includeTurn: true, required: ['service', 'broker', 'turn-credential-service'], primary: {status: 'healthy', broker: {status: 'ready', backend: 'redis'}}, turn: {status: 'ready', network: {status: 'reachable', total: 1, reachable: 1}}};
const hardware = platform => ({platform, status: 'ready', package: {state: 'ready'}, hardware: {state: 'ready'}, execution: {state: 'ready', capture: 'verified', audio: 'verified', input: 'verified', haptics: 'verified'}});
const virtual = platform => ({platform, status: 'ready', capabilities: {execute: true}, exercise: {state: 'verified'}});
const signed = platform => ({platform, status: 'verified'});

test('roadmap acceptance stays incomplete and names every missing external gate', () => {
  const result = assessRoadmapAcceptance({productionReport: {status: 'healthy'}, hardwareReports: [], virtualGamepadReports: [], signedPackageReports: []});
  assert.equal(result.status, 'incomplete'); assert.deepEqual(result.blockers, ['production-services', 'native-hardware', 'desktop-virtual-gamepads', 'external-package-signing']);
});

test('roadmap acceptance does not accept an in-memory broker or unprobed TURN relay', () => {
  const report = {...production, primary: {status: 'healthy', broker: {status: 'ready', backend: 'memory'}}, turn: {status: 'ready'}};
  const result = assessRoadmapAcceptance({productionReport: report});
  assert.equal(result.gates.find(gate => gate.id === 'production-services').status, 'missing');
});

test('roadmap acceptance completes only with all production, hardware, driver, and signing evidence', () => {
  const result = assessRoadmapAcceptance({productionReport: production, hardwareReports: [hardware('linux'), hardware('win32'), hardware('darwin')], virtualGamepadReports: [virtual('win32'), virtual('darwin')], signedPackageReports: [signed('linux'), signed('win32'), signed('darwin')]});
  assert.equal(result.status, 'complete'); assert.deepEqual(result.blockers, []); assert.ok(result.gates.every(gate => gate.status === 'verified'));
});

test('roadmap acceptance requires Linux hardware readiness and desktop injection exercises', () => {
  const linux = hardware('linux'); linux.hardware = {state: 'unavailable'};
  const result = assessRoadmapAcceptance({productionReport: production, hardwareReports: [linux, hardware('win32'), hardware('darwin')], virtualGamepadReports: [virtual('win32'), virtual('darwin')], signedPackageReports: [signed('linux'), signed('win32'), signed('darwin')]});
  assert.equal(result.status, 'incomplete'); assert.deepEqual(result.gates.find(gate => gate.id === 'native-hardware').missing, ['linux']);
});

test('roadmap acceptance verifies supplied signed manifests before accepting package custody', async () => {
  const calls = []; const result = await assessRoadmapAcceptanceWithSignedManifests({productionReport: production, hardwareReports: [hardware('linux'), hardware('win32'), hardware('darwin')], virtualGamepadReports: [virtual('win32'), virtual('darwin')], signedManifestPaths: ['/release/linux.json', '/release/windows.json', '/release/macos.json'], publicKeyJwk: {kty: 'EC'}, verifyManifest: async input => { calls.push(input); return signed(input.manifestPath.includes('linux') ? 'linux' : input.manifestPath.includes('windows') ? 'win32' : 'darwin'); }});
  assert.equal(result.status, 'complete'); assert.equal(calls.length, 3); assert.equal(calls[0].publicKeyJwk.kty, 'EC');
});

test('roadmap acceptance rejects signed manifests without a public key', async () => {
  await assert.rejects(() => assessRoadmapAcceptanceWithSignedManifests({productionReport: production, signedManifestPaths: ['/release/linux.json']}), /publicKeyJwk is required/);
});

test('roadmap acceptance workflow requires the complete runner-local evidence layout', () => {
  assert.match(acceptanceWorkflow, /workflow_dispatch:/); assert.match(acceptanceWorkflow, /runs-on: \$\{\{ inputs\.runner_label \}\}/);
  assert.match(acceptanceWorkflow, /production\/rollout\.json/); assert.match(acceptanceWorkflow, /hardware\/linux\.json/); assert.match(acceptanceWorkflow, /hardware\/win32\.json/); assert.match(acceptanceWorkflow, /hardware\/darwin\.json/);
  assert.match(acceptanceWorkflow, /virtual-gamepad\/win32\.json/); assert.match(acceptanceWorkflow, /virtual-gamepad\/darwin\.json/); assert.match(acceptanceWorkflow, /--signed-manifest/); assert.match(acceptanceWorkflow, /--public-key-file/); assert.match(acceptanceWorkflow, /actions\/upload-artifact@v7/);
  assert.doesNotMatch(acceptanceWorkflow, /SPARTAN_.*SECRET\s*:/);
});
