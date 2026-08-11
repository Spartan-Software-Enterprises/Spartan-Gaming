import assert from 'node:assert/strict';
import test from 'node:test';
import { createSessionEnvelope } from '../src/frontend/session/session.mjs';
import { createBroker } from './redis-broker.mjs';

test('Redis broker claims role locks and routes a session envelope through pub/sub', async () => {
  const url = process.env.SPARTAN_TEST_REDIS_URL || 'redis://127.0.0.1:6379';
  const secret = 'redis-integration-secret-012345678901234567890';
  const sessionId = `ses-redis-${Date.now()}`;
  const received = [];
  const clientBroker = await createBroker({
    secret,
    environment: { SPARTAN_SIGNALING_REDIS_URL: url },
  });
  const hostBroker = await createBroker({
    secret,
    environment: { SPARTAN_SIGNALING_REDIS_URL: url },
  });
  try {
    const client = await clientBroker.attach({
      sessionId,
      role: 'client',
      ticket: clientBroker.issueTicket({ sessionId, role: 'client' }),
      send() {},
    });
    const host = await hostBroker.attach({
      sessionId,
      role: 'host',
      ticket: hostBroker.issueTicket({ sessionId, role: 'host' }),
      send: (message) => received.push(message),
    });
    await client.send(
      createSessionEnvelope({ sessionId, type: 'session.offer', payload: { role: 'client' } }),
    );
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(received[0]?.type, 'session.offer');
    assert.deepEqual(clientBroker.stats(), { sessions: 1, participants: 1 });
    assert.deepEqual(hostBroker.stats(), { sessions: 1, participants: 1 });
    await client.detach();
    await host.detach();
  } finally {
    await clientBroker.close();
    await hostBroker.close();
  }
  assert.deepEqual(await clientBroker.health(), { status: 'unavailable', backend: 'redis' });
});
