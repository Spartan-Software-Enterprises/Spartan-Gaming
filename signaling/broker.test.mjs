import assert from 'node:assert/strict';
import test from 'node:test';
import {createSessionEnvelope} from '../src/frontend/session/session.mjs';
import {createSignalingBroker} from './broker.mjs';

const offer = () => createSessionEnvelope({sessionId: 'ses-signal-01', type: 'session.offer', payload: {role: 'client'}});

test('signaling broker authenticates scoped tickets and routes messages between roles', () => {
  let now = 1000;
  const broker = createSignalingBroker({secret: 'test-only-secret', clock: () => now});
  const received = [];
  const client = broker.attach({sessionId: 'ses-signal-01', role: 'client', ticket: broker.issueTicket({sessionId: 'ses-signal-01', role: 'client'}), send: message => received.push(['client', message.type])});
  const host = broker.attach({sessionId: 'ses-signal-01', role: 'host', ticket: broker.issueTicket({sessionId: 'ses-signal-01', role: 'host'}), send: message => received.push(['host', message.type])});
  client.send(offer());
  assert.deepEqual(received, [['host', 'session.offer']]);
  assert.deepEqual(broker.stats(), {sessions: 1, participants: 2});
  host.detach(); client.detach();
  assert.deepEqual(broker.stats(), {sessions: 0, participants: 0});
  now += 1;
});

test('signaling broker rejects expired, cross-session, duplicate-role, and oversized messages', () => {
  let now = 1000;
  const broker = createSignalingBroker({secret: 'test-only-secret', clock: () => now});
  const clientTicket = broker.issueTicket({sessionId: 'ses-signal-02', role: 'client', ttlMs: 1000});
  now += 1001;
  assert.throws(() => broker.attach({sessionId: 'ses-signal-02', role: 'client', ticket: clientTicket, send() {}}), /expired/);
  now = 1000;
  const valid = broker.issueTicket({sessionId: 'ses-signal-02', role: 'client'});
  const client = broker.attach({sessionId: 'ses-signal-02', role: 'client', ticket: valid, send() {}});
  assert.throws(() => broker.attach({sessionId: 'ses-signal-02', role: 'client', ticket: valid, send() {}}), /already attached/);
  assert.throws(() => client.send(createSessionEnvelope({sessionId: 'ses-other-01', type: 'session.offer', payload: {}})), /another signaling session/);
  const huge = createSessionEnvelope({sessionId: 'ses-signal-02', type: 'session.offer', payload: {blob: 'x'.repeat(70 * 1024)}});
  assert.throws(() => client.send(huge), /too large/);
  client.detach();
});

test('signaling broker rejects forged ticket signatures and invalid roles', () => {
  const broker = createSignalingBroker({secret: 'test-only-secret'});
  assert.throws(() => broker.attach({sessionId: 'ses-signal-03', role: 'host', ticket: 'forged.signature', send() {}}), /invalid signaling ticket/);
  assert.throws(() => broker.issueTicket({sessionId: 'ses-signal-03', role: 'relay'}), /role must be client or host/);
});
