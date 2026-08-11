import { checkProviderReachability } from './health.mjs';

export async function checkProviderCatalog(
  entries,
  { check = checkProviderReachability, concurrency = 4 } = {},
) {
  if (!Array.isArray(entries)) throw new TypeError('provider entries must be an array');
  if (typeof check !== 'function')
    throw new TypeError('provider health checker must be a function');
  const providers = entries.filter((entry) => entry?.backendType === 'provider');
  const results = new Array(providers.length);
  let cursor = 0;
  async function worker() {
    while (cursor < providers.length) {
      const index = cursor++;
      const entry = providers[index];
      try {
        results[index] = { providerId: entry.id, result: await check({ url: entry.url }) };
      } catch (error) {
        results[index] = {
          providerId: entry.id,
          result: {
            status: 'indeterminate',
            reason: error?.message || 'provider could not be checked',
          },
        };
      }
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(providers.length, Math.max(1, Math.min(8, Number(concurrency) || 4))) },
      () => worker(),
    ),
  );
  return Object.freeze(
    results.map((item) =>
      Object.freeze({ providerId: item.providerId, result: Object.freeze({ ...item.result }) }),
    ),
  );
}
