import assert from 'node:assert/strict';
import test from 'node:test';
import {createMessageRateLimiter, createSignalingServer, isOriginAllowed, normalizeServiceOptions} from './agent.mjs';

test('signaling service defaults are bounded and origins are opt-in', () => {
  const config = normalizeServiceOptions({secret: 'test'});
  assert.equal(config.maxConnections, 256);
  assert.equal(config.maxMessagesPerSecond, 120);
  assert.equal(isOriginAllowed(undefined, []), true);
  assert.equal(isOriginAllowed('https://game.example', ['https://game.example']), true);
  assert.equal(isOriginAllowed('https://evil.example', ['https://game.example']), false);
});

test('signaling message rate limiter resets each window', () => {
  let now = 0;
  const limiter = createMessageRateLimiter({limit: 2, windowMs: 1000, clock: () => now});
  assert.equal(limiter.take(), true); assert.equal(limiter.take(), true); assert.equal(limiter.take(), false);
  now = 1000; assert.equal(limiter.take(), true);
});

test('signaling health endpoint exposes bounded operational state', async () => {
  const service = createSignalingServer({secret: 'test-secret', bind: '127.0.0.1', port: 0, allowedOrigins: ['https://game.example'], maxConnections: 3, maxMessagesPerSecond: 4});
  try {
    const address = await service.start();
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body.limits, {maxConnections: 3, maxMessagesPerSecond: 4});
    assert.equal(body.connections, 0);
    assert.equal(body.rejectedConnections, 0);
    assert.equal(body.sessions, 0);
  } finally {
    await service.close();
  }
});
