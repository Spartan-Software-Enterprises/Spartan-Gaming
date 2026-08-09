function required(value, name) { if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`); return value.trim(); }

/** Create the browser-to-native-updater handoff without side effects. */
export function createAdapterInstallRequest({updatePlan, platform, consent = false} = {}) {
  if (updatePlan?.status !== 'update-available') throw new Error('an available adapter update is required');
  if (consent !== true) throw new Error('explicit user consent is required before installing an adapter');
  const manifest = updatePlan.adapter;
  if (!manifest || manifest.trust !== 'signed' || updatePlan.readiness?.status !== 'ready') throw new Error('only verified signed adapters can be installed');
  if (platform && !manifest.platforms.includes(platform) && !manifest.platforms.includes('universal')) throw new Error('adapter does not support the requested platform');
  if (!manifest.artifact) throw new Error('adapter release does not provide a signed artifact descriptor');
  return Object.freeze({version: 1, id: required(manifest.id, 'adapter.id'), kind: required(manifest.kind, 'adapter.kind'), from: required(updatePlan.from, 'update.from'), to: required(updatePlan.to, 'update.to'), platform: platform || 'universal', artifact: manifest.artifact, ...(manifest.package ? {package: manifest.package} : {}), verification: Object.freeze({integrity: manifest.integrity, signature: manifest.signature, license: manifest.license}), installScope: 'user', requiresRestart: true});
}

/** Map a release planner result (install-available) onto the update-plan shape required by an install request. */
export function toAdapterUpdatePlan(plan) {
  if (!plan) throw new TypeError('a release plan is required');
  if (plan.status === 'install-available') {
    const adapter = plan.candidate || plan.adapter;
    if (!adapter) throw new TypeError('install-available plan requires a candidate adapter');
    return Object.freeze({status: 'update-available', id: adapter.id, from: adapter.version, to: adapter.version, adapter, readiness: plan.readiness});
  }
  return plan;
}

/** Build a consented install handoff from a release planner plan without side effects. */
export function createAdapterReleaseInstallRequest({plan, platform, consent = false} = {}) {
  return createAdapterInstallRequest({updatePlan: toAdapterUpdatePlan(plan), platform, consent});
}
