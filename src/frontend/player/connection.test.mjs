import assert from 'node:assert/strict';
import test from 'node:test';
import { hasAuthenticatedPlayerConnection, normalizePlayerConnection } from './connection.mjs';

test('player connection fields are normalized without persistence', () => {
  assert.deepEqual(
    normalizePlayerConnection({
      endpoint: ' wss://relay.example/signal ',
      sessionId: ' ses-123 ',
      ticket: ' ticket ',
    }),
    { endpoint: 'wss://relay.example/signal', sessionId: 'ses-123', ticket: 'ticket' },
  );
  assert.equal(
    hasAuthenticatedPlayerConnection({
      endpoint: 'wss://relay.example/signal',
      sessionId: 'ses-123',
      ticket: 'ticket',
    }),
    true,
  );
  assert.equal(
    hasAuthenticatedPlayerConnection({
      endpoint: 'wss://relay.example/signal',
      sessionId: 'ses-123',
    }),
    false,
  );
});
