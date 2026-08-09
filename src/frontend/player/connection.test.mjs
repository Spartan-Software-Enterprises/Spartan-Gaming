import assert from 'node:assert/strict';
import test from 'node:test';
import {hasAuthenticatedPlayerConnection, normalizePlayerConnection} from './connection.mjs';

test('player connection fields are normalized without persistence', () => {
  assert.deepEqual(normalizePlayerConnection({endpoint: ' wss://relay.example/signal ', sessionId: ' ses-123 ', ticket: ' ticket '}), {endpoint: 'wss://relay.example/signal', sessionId: 'ses-123', ticket: 'ticket'});
  assert.equal(hasAuthenticatedPlayerConnection({endpoint: 'wss://relay.example/signal', sessionId: 'ses-123', ticket: 'ticket'}), true);
  assert.equal(hasAuthenticatedPlayerConnection({endpoint: 'wss://relay.example/signal', sessionId: 'ses-123'}), false);
});

test('player connections reject insecure, credentialed, and malformed signaling endpoints', () => {
  assert.equal(normalizePlayerConnection({endpoint: 'ws://relay.example/signal'}).endpoint, '');
  assert.equal(normalizePlayerConnection({endpoint: 'wss://user:ticket@relay.example/signal'}).endpoint, '');
  assert.equal(normalizePlayerConnection({endpoint: 'not a URL'}).endpoint, '');
  assert.equal(normalizePlayerConnection({endpoint: 'ws://localhost:8790/signal'}).endpoint, 'ws://localhost:8790/signal');
  assert.equal(normalizePlayerConnection({endpoint: 'https://relay.example/signal'}).endpoint, 'https://relay.example/signal');
});
