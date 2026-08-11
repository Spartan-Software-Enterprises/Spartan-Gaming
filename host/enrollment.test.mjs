import assert from 'node:assert/strict';
import test from 'node:test';
import { createHostEnrollmentPlan } from './enrollment.mjs';

test('host enrollment validates endpoint and keeps ticket session-only in diagnostics', () => {
  const plan = createHostEnrollmentPlan({
    endpoint: 'wss://signal.example/signal',
    sessionId: 'ses-123',
    ticket: 'signed-ticket',
  });
  assert.equal(plan.endpoint, 'wss://signal.example/signal');
  assert.equal(plan.args[4], '--signal-ticket');
  assert.equal(plan.args[5], 'signed-ticket');
  assert.equal(plan.diagnostics.ticket, 'session-only');
  assert.equal(plan.persistence.profile, 'never');
});

test('host enrollment rejects insecure remote endpoints and malformed sessions', () => {
  assert.throws(
    () =>
      createHostEnrollmentPlan({
        endpoint: 'ws://signal.example',
        sessionId: 'ses',
        ticket: 'ticket',
      }),
    /TLS|secure|insecure/,
  );
  assert.throws(
    () =>
      createHostEnrollmentPlan({
        endpoint: 'wss://signal.example',
        sessionId: 'bad session',
        ticket: 'ticket',
      }),
    /bounded/,
  );
  assert.throws(
    () => createHostEnrollmentPlan({ endpoint: 'wss://signal.example', sessionId: 'ses' }),
    /ticket/,
  );
});
