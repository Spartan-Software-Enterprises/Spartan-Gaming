import assert from 'node:assert/strict';
import test from 'node:test';
import {createBroker} from './redis-broker.mjs';

test('Redis broker requires an explicit Redis endpoint and rejects unsafe schemes', async () => {
  await assert.rejects(() => createBroker({secret: 'test-secret', environment: {}}), /Redis URL is required/);
  await assert.rejects(() => createBroker({secret: 'test-secret', environment: {SPARTAN_SIGNALING_REDIS_URL: 'http://redis:6379'}}), /redis:\/\//);
});
