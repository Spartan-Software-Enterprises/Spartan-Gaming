import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateReconnectDelay, createReconnectPolicy} from './recovery.mjs';
import './reconnect-controller.test.mjs';

test('reconnect delay grows exponentially and caps at the maximum', () => {
  assert.equal(calculateReconnectDelay(1, {baseDelayMs: 250, maxDelayMs: 1000}), 250);
  assert.equal(calculateReconnectDelay(2, {baseDelayMs: 250, maxDelayMs: 1000}), 500);
  assert.equal(calculateReconnectDelay(4, {baseDelayMs: 250, maxDelayMs: 1000}), 1000);
});

test('reconnect jitter stays within the configured range', () => {
  assert.equal(calculateReconnectDelay(2, {baseDelayMs: 1000, maxDelayMs: 10_000, jitter: 0.25, random: () => 0}), 1500);
  assert.equal(calculateReconnectDelay(2, {baseDelayMs: 1000, maxDelayMs: 10_000, jitter: 0.25, random: () => 1}), 2500);
});

test('reconnect policy bounds attempts and resets after success', () => {
  const policy = createReconnectPolicy({maxAttempts: 2, baseDelayMs: 100, jitter: 0});
  assert.deepEqual(policy.next(), {attempt: 1, delayMs: 100, exhausted: false});
  assert.deepEqual(policy.next(), {attempt: 2, delayMs: 200, exhausted: false});
  assert.deepEqual(policy.next(), {attempt: 2, delayMs: 0, exhausted: true});
  policy.succeeded();
  assert.equal(policy.attempt, 0);
  assert.equal(policy.exhausted, false);
});
