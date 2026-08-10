import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {createSignalingBroker} from '../signaling/broker.mjs';

test('ticket CLI mints a scoped short-lived ticket without echoing the secret', () => {
  const secret = 'test-provisioning-secret';
  const result = spawnSync(process.execPath, ['scripts/issue-signaling-ticket.mjs', '--session', 'ses-cli-01', '--role', 'client', '--subject', 'browser-01', '--ttl-ms', '60000'], {encoding: 'utf8', env: {...process.env, SPARTAN_SIGNALING_SECRET: secret}});
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, new RegExp(secret));
  assert.doesNotMatch(result.stderr, new RegExp(secret));
  const output = JSON.parse(result.stdout);
  assert.deepEqual({version: output.version, sessionId: output.sessionId, role: output.role, subject: output.subject, ttlMs: output.ttlMs}, {version: 1, sessionId: 'ses-cli-01', role: 'client', subject: 'browser-01', ttlMs: 60000});
  const broker = createSignalingBroker({secret});
  const participant = broker.attach({sessionId: output.sessionId, role: output.role, ticket: output.ticket, send() {}});
  participant.detach();
});

test('ticket CLI fails without required provisioning inputs', () => {
  const result = spawnSync(process.execPath, ['scripts/issue-signaling-ticket.mjs', '--session', 'ses-cli-02'], {encoding: 'utf8', env: {...process.env, SPARTAN_SIGNALING_SECRET: ''}});
  assert.equal(result.status, 2);
  assert.match(result.stderr, /usage:/);
});
