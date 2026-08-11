import test from 'node:test';
import assert from 'node:assert/strict';
import { checkProviderCatalog } from './catalog-health.mjs';

test('provider catalog health checks are bounded, ordered, and credential-free by contract', async () => {
  let active = 0;
  let peak = 0;
  const result = await checkProviderCatalog(
    [
      { id: 'one', backendType: 'provider', url: 'https://one.example' },
      { id: 'two', backendType: 'provider', url: 'https://two.example' },
      { id: 'three', backendType: 'provider', url: 'https://three.example' },
    ],
    {
      concurrency: 2,
      check: async ({ url }) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 2));
        active -= 1;
        return { status: url.includes('two') ? 'unavailable' : 'reachable', url };
      },
    },
  );
  assert.equal(peak, 2);
  assert.deepEqual(
    result.map((item) => item.providerId),
    ['one', 'two', 'three'],
  );
  assert.equal(result[1].result.status, 'unavailable');
});
test('provider catalog health checks convert checker errors into indeterminate status', async () => {
  const result = await checkProviderCatalog(
    [{ id: 'one', backendType: 'provider', url: 'https://one.example' }],
    {
      check: async () => {
        throw new Error('CORS');
      },
    },
  );
  assert.deepEqual(result, [
    { providerId: 'one', result: { status: 'indeterminate', reason: 'CORS' } },
  ]);
});
