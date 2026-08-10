/** Resolve provider startup work without coupling it to account or credential state. */
export function resolveProviderStartupPolicy(settings = {}) {
  const healthChecks = settings['providers.healthChecks'] === true;
  const prewarmProviders = settings['performance.prewarmProviders'] === true;
  return Object.freeze({healthChecks, prewarmProviders, shouldProbe: healthChecks || prewarmProviders});
}
