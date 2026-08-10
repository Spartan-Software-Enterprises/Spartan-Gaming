import assert from 'node:assert/strict';
import test from 'node:test';
import {assessRoadmapAcceptance} from './acceptance.mjs';

const production = {status: 'healthy', required: ['service', 'broker', 'turn-credential-service'], primary: {status: 'healthy', broker: {status: 'ready'}}, turn: {status: 'ready'}};
const hardware = platform => ({platform, status: 'ready', package: {state: 'ready'}, hardware: {state: 'ready'}, execution: {state: 'ready', capture: 'verified', audio: 'verified', input: 'verified', haptics: 'verified'}});
const virtual = platform => ({platform, status: 'ready', capabilities: {execute: true}, exercise: {state: 'verified'}});
const signed = platform => ({platform, status: 'verified'});

test('roadmap acceptance stays incomplete and names every missing external gate', () => {
  const result = assessRoadmapAcceptance({productionReport: {status: 'healthy'}, hardwareReports: [], virtualGamepadReports: [], signedPackageReports: []});
  assert.equal(result.status, 'incomplete'); assert.deepEqual(result.blockers, ['production-services', 'native-hardware', 'desktop-virtual-gamepads', 'external-package-signing']);
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
