import {createAdapterManifestRegistry, createAdapterUpdatePlan, normalizeAdapterManifest, verifyAdapterSignature} from '../src/frontend/adapters/manifest-registry.mjs';
import {createAdapterInstallRequest} from '../src/frontend/adapters/install.mjs';
import {canonicalizePackageManifest} from './package-signing.mjs';

function required(value, name) { if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`); return value.trim(); }

/** Normalize a signed release feed without verifying signatures. */
export function normalizeReleaseFeed(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('release feed must be an object');
  if (value.schemaVersion !== 1) throw new TypeError('release feed schemaVersion must be 1');
  const updatedAt = required(value.updatedAt, 'release feed.updatedAt');
  if (!Array.isArray(value.records) || value.records.length > 500) throw new TypeError('release feed.records must contain up to 500 entries');
  const records = value.records.map(normalizeAdapterManifest);
  const seen = new Set();
  for (const record of records) { if (seen.has(record.id)) throw new Error(`duplicate release feed entry: ${record.id}`); seen.add(record.id); }
  return Object.freeze({schemaVersion: 1, updatedAt, signer: typeof value.signer === 'string' ? value.signer : null, records: Object.freeze(records), signature: value.signature ? Object.freeze({algorithm: required(value.signature.algorithm, 'release feed.signature.algorithm'), signer: required(value.signature.signer, 'release feed.signature.signer'), value: required(value.signature.value, 'release feed.signature.value')}) : null});
}

/** Verify the canonical feed payload against a trusted public key. */
export async function verifyReleaseFeed({feed, publicKeyJwk, subtle = globalThis.crypto?.subtle} = {}) {
  const normalized = normalizeReleaseFeed(feed);
  if (!normalized.signature) throw new TypeError('a signed release feed is required');
  const canonical = canonicalizePackageManifest(normalized);
  return verifyAdapterSignature({data: canonical, signature: normalized.signature, publicKeyJwk, subtle});
}

/** Select the highest verified compatible release for every known adapter id. */
export function createReleaseFeedPlanner({feed, platform, kind, installed = [], allowUnsigned = false} = {}) {
  const normalized = normalizeReleaseFeed(feed);
  if (platform && !['win32', 'darwin', 'linux', 'browser'].includes(platform)) throw new TypeError(`unsupported release feed platform: ${platform}`);
  const registry = createAdapterManifestRegistry({records: normalized.records, platform, allowUnsigned});
  const current = new Map((Array.isArray(installed) ? installed : []).map(normalizeAdapterManifest).map(record => [record.id, record]));
  const plans = normalized.records
    .filter(record => !kind || record.kind === kind)
    .map(record => {
      const installedRecord = current.get(record.id);
      if (!installedRecord) return Object.freeze({id: record.id, status: 'install-available', candidate: record, readiness: registry.resolve(record.id, {kind: record.kind, allowUnsigned})});
      const plan = createAdapterUpdatePlan({current: installedRecord, candidates: [record], platform, kind: record.kind, allowUnsigned});
      return plan;
    });
  return Object.freeze({platform, kind: kind || null, plans: Object.freeze(plans), registry});
}

/** Create a consented, side-effect-free install handoff from a release plan. */
export function createReleaseInstallRequest({plan, platform, consent = false} = {}) {
  if (!plan) throw new TypeError('a release plan is required');
  const updatePlan = plan.status === 'install-available' ? Object.freeze({status: 'update-available', id: plan.candidate.id, from: plan.candidate.version, to: plan.candidate.version, adapter: plan.candidate, readiness: plan.readiness}) : plan;
  return createAdapterInstallRequest({updatePlan, platform, consent});
}
