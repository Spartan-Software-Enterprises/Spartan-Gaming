#!/usr/bin/env node
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {verifyReleaseManifest} from '../native/verify-release.mjs';

const PLATFORMS = Object.freeze(['win32', 'darwin', 'linux']);
const ALIASES = Object.freeze({windows: 'win32', win: 'win32', macos: 'darwin', mac: 'darwin', osx: 'darwin', linux: 'linux'});

function platform(value) { const result = ALIASES[String(value || '').toLowerCase()] || String(value || '').toLowerCase(); return PLATFORMS.includes(result) ? result : null; }
function text(value) { return typeof value === 'string' ? value.trim() : ''; }
function readJson(value, name) { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`); return value; }
function reportPlatform(report) { return platform(report?.platform); }
function rejectDuplicateReports(reports, identity, name) { const seen = new Set(); for (const report of reports) { const value = identity(report); if (!value) continue; if (seen.has(value)) throw new Error(`${name} contains duplicate evidence for ${value}`); seen.add(value); } }

function productionGate(report) {
  const required = Array.isArray(report?.required) ? report.required : [];
  const brokerReady = report?.primary?.broker?.status === 'ready' && report.primary.broker.backend === 'redis';
  const turnReady = report?.turn?.status === 'ready' && report?.turn?.network?.status === 'reachable';
  const securityReady = report?.security?.credentials === 'external-secret-files' && report?.security?.tls === 'configured';
  const ready = report?.status === 'healthy' && report?.primary?.status === 'healthy' && brokerReady && required.includes('broker') && report?.includeTurn === true && turnReady && required.includes('turn-credential-service') && securityReady;
  return Object.freeze({id: 'production-services', status: ready ? 'verified' : 'missing', evidence: ready ? {broker: 'ready', brokerBackend: 'redis', turnCredentials: 'ready', turnNetwork: 'reachable', tls: 'configured', credentials: 'external-secret-files'} : null});
}

function hardwareGate(reports) {
  const byPlatform = new Map(reports.map(report => [reportPlatform(report), report]));
  const missing = PLATFORMS.filter(target => { const report = byPlatform.get(target); return !report || report.kind !== 'native-hardware-report' || report.verification !== 'runtime-exercise' || report.status !== 'ready' || report.package?.state !== 'ready' || report.execution?.state !== 'ready' || report.execution?.capture !== 'verified' || report.execution?.audio !== 'verified' || report.execution?.input !== 'verified' || report.execution?.haptics !== 'verified' || (target === 'linux' && report.hardware?.state !== 'ready'); });
  return Object.freeze({id: 'native-hardware', status: missing.length ? 'missing' : 'verified', missing: Object.freeze(missing)});
}

function virtualDriverGate(reports) {
  const byPlatform = new Map(reports.map(report => [reportPlatform(report), report]));
  const missing = ['win32', 'darwin'].filter(target => { const report = byPlatform.get(target); return !report || report.kind !== 'virtual-gamepad-exercise' || report.verification !== 'signed-runtime-exercise' || report.status !== 'ready' || report.driver?.state !== 'ready' || report.exercise?.state !== 'verified' || report.capabilities?.execute !== true; });
  return Object.freeze({id: 'desktop-virtual-gamepads', status: missing.length ? 'missing' : 'verified', missing: Object.freeze(missing)});
}

function signingGate(reports) {
  const verified = new Set(reports.filter(report => report?.kind === 'signed-release-manifest' && report?.verification === 'webcrypto' && report?.status === 'verified' && text(report.signer) && platform(report.platform)).map(report => platform(report.platform)));
  const missing = PLATFORMS.filter(target => !verified.has(target));
  return Object.freeze({id: 'external-package-signing', status: missing.length ? 'missing' : 'verified', missing: Object.freeze(missing)});
}

const STEAMOS_TARGETS = Object.freeze({deck: 'steam-deck', desktop: 'steam-os-desktop'});
const STEAMOS_CHECKS = Object.freeze(['gameMode', 'desktopMode', 'steamInput', 'glyphs', 'textEntry', 'touchTrackpadGyroRear', 'gamescope', 'protonNative', 'suspendResume', 'battery', 'externalDisplay']);

function steamOsTarget(value) {
  const normalized = text(value).toLowerCase().replaceAll('_', '-');
  if (normalized === 'steam-deck' || normalized === 'deck') return STEAMOS_TARGETS.deck;
  if (normalized === 'steam-os-desktop' || normalized === 'steam-machine' || normalized === 'steamos-desktop') return STEAMOS_TARGETS.desktop;
  return null;
}

function steamOsGate(reports) {
  const byTarget = new Map(reports.map(report => [steamOsTarget(report?.target), report]));
  const missing = Object.values(STEAMOS_TARGETS).filter(target => {
    const report = byTarget.get(target);
    return !report || report.kind !== 'steamos-hardware-report' || report.verification !== 'runtime-exercise' || report.status !== 'ready' || STEAMOS_CHECKS.some(check => report.checks?.[check] !== 'verified');
  });
  return Object.freeze({id: 'steam-os-hardware', status: missing.length ? 'missing' : 'verified', missing: Object.freeze(missing)});
}

/** Assess the external evidence required before the final roadmap boxes may be checked. */
export function assessRoadmapAcceptance({productionReport, hardwareReports = [], virtualGamepadReports = [], signedPackageReports = [], steamOsReports = []} = {}) {
  const production = productionGate(readJson(productionReport, 'productionReport'));
  const hardwareEvidence = hardwareReports.map(report => readJson(report, 'hardware report'));
  const virtualEvidence = virtualGamepadReports.map(report => readJson(report, 'virtual-gamepad report'));
  const signingEvidence = signedPackageReports.map(report => readJson(report, 'signed-package report'));
  const steamEvidence = steamOsReports.map(report => readJson(report, 'SteamOS hardware report'));
  rejectDuplicateReports(hardwareEvidence, reportPlatform, 'hardware reports');
  rejectDuplicateReports(virtualEvidence, reportPlatform, 'virtual-gamepad reports');
  rejectDuplicateReports(signingEvidence, reportPlatform, 'signed-package reports');
  rejectDuplicateReports(steamEvidence, report => steamOsTarget(report?.target), 'SteamOS reports');
  const hardware = hardwareGate(hardwareEvidence);
  const virtualGamepads = virtualDriverGate(virtualEvidence);
  const signing = signingGate(signingEvidence);
  const steamOs = steamOsGate(steamEvidence);
  const gates = Object.freeze([production, hardware, virtualGamepads, signing, steamOs]);
  return Object.freeze({version: 1, kind: 'roadmap-acceptance', status: gates.every(gate => gate.status === 'verified') ? 'complete' : 'incomplete', gates, blockers: Object.freeze(gates.filter(gate => gate.status !== 'verified').map(gate => gate.id))});
}

/** Verify signed manifest files before feeding their reports into acceptance. */
export async function assessRoadmapAcceptanceWithSignedManifests({productionReport, hardwareReports = [], virtualGamepadReports = [], signedPackageReports = [], steamOsReports = [], signedManifestPaths = [], publicKeyJwk, verifyManifest = verifyReleaseManifest} = {}) {
  if (signedManifestPaths.length && (!publicKeyJwk || typeof publicKeyJwk !== 'object')) throw new TypeError('publicKeyJwk is required when signed manifests are supplied');
  const verifiedManifests = await Promise.all(signedManifestPaths.map(manifestPath => verifyManifest({manifestPath: path.resolve(manifestPath), publicKeyJwk})));
  return assessRoadmapAcceptance({productionReport, hardwareReports, virtualGamepadReports, steamOsReports, signedPackageReports: [...signedPackageReports, ...verifiedManifests]});
}

function argumentValues(argv, name) { const values = []; for (let index = 0; index < argv.length; index += 1) if (argv[index] === name && argv[index + 1]) values.push(argv[index + 1]); return values; }
async function loadReports(paths, name) { return Promise.all(paths.map(async value => readJson(JSON.parse(await readFile(path.resolve(value), 'utf8')), name))); }
async function writeReport(file, report) { if (!text(file)) return; const target = path.resolve(file); if (target === path.parse(target).root) throw new TypeError('report file cannot be the filesystem root'); await writeFile(target, `${JSON.stringify(report, null, 2)}\n`, {encoding: 'utf8', mode: 0o600}); }

if (path.resolve(process.argv[1] || '') === path.resolve(new URL(import.meta.url).pathname)) {
  try {
    const argv = process.argv.slice(2); const productionPath = argumentValues(argv, '--production-report')[0]; if (!productionPath) throw new Error('--production-report is required');
    const publicKeyPath = argumentValues(argv, '--public-key-file')[0]; const signedManifestPaths = argumentValues(argv, '--signed-manifest'); const publicKeyJwk = publicKeyPath ? JSON.parse(await readFile(path.resolve(publicKeyPath), 'utf8')) : undefined;
    const result = await assessRoadmapAcceptanceWithSignedManifests({productionReport: JSON.parse(await readFile(path.resolve(productionPath), 'utf8')), hardwareReports: await loadReports(argumentValues(argv, '--hardware-report'), 'hardware report'), virtualGamepadReports: await loadReports(argumentValues(argv, '--virtual-gamepad-report'), 'virtual-gamepad report'), steamOsReports: await loadReports(argumentValues(argv, '--steamos-report'), 'SteamOS hardware report'), signedPackageReports: await loadReports(argumentValues(argv, '--signed-package-report'), 'signed-package report'), signedManifestPaths, publicKeyJwk});
    await writeReport(argumentValues(argv, '--report-file')[0], result); console.log(JSON.stringify(result, null, 2)); if (result.status !== 'complete') process.exitCode = 2;
  } catch (error) { console.error(`roadmap acceptance failed: ${error.message}`); process.exitCode = 1; }
}
