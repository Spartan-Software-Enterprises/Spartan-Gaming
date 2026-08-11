function required(value, name) {
  if (typeof value !== 'string' || !value.trim())
    throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}

/** Create the browser-to-native-updater handoff without side effects. */
export function createAdapterInstallRequest({ updatePlan, platform, consent = false } = {}) {
  if (updatePlan?.status !== 'update-available')
    throw new Error('an available adapter update is required');
  if (consent !== true)
    throw new Error('explicit user consent is required before installing an adapter');
  const manifest = updatePlan.adapter;
  if (!manifest || manifest.trust !== 'signed' || updatePlan.readiness?.status !== 'ready')
    throw new Error('only verified signed adapters can be installed');
  if (
    platform &&
    !manifest.platforms.includes(platform) &&
    !manifest.platforms.includes('universal')
  )
    throw new Error('adapter does not support the requested platform');
  if (!manifest.artifact)
    throw new Error('adapter release does not provide a signed artifact descriptor');
  return Object.freeze({
    version: 1,
    id: required(manifest.id, 'adapter.id'),
    kind: required(manifest.kind, 'adapter.kind'),
    from: required(updatePlan.from, 'update.from'),
    to: required(updatePlan.to, 'update.to'),
    platform: platform || 'universal',
    artifact: manifest.artifact,
    verification: Object.freeze({
      integrity: manifest.integrity,
      signature: manifest.signature,
      license: manifest.license,
    }),
    installScope: 'user',
    requiresRestart: true,
  });
}
