import test from 'node:test';
import assert from 'node:assert/strict';
import { createReconnectController } from './reconnect-controller.mjs';
import { createReconnectPolicy } from './recovery.mjs';

function fakeTimers() {
  const timers = [];
  return {
    timers,
    setTimeoutFn(callback, delay) {
      timers.push({ callback, delay, cancelled: false });
      return timers.length - 1;
    },
    clearTimeoutFn(id) {
      if (timers[id]) timers[id].cancelled = true;
    },
    runNext() {
      const timer = timers.find((item) => !item.cancelled && !item.ran);
      if (!timer) return;
      timer.ran = true;
      timer.callback();
    },
  };
}

test('reconnect controller exposes bounded attempts and schedules failures', () => {
  const clock = fakeTimers();
  const attempts = [];
  const controller = createReconnectController({
    policy: createReconnectPolicy({ maxAttempts: 2, baseDelayMs: 100, jitter: 0 }),
    setTimeoutFn: clock.setTimeoutFn,
    clearTimeoutFn: clock.clearTimeoutFn,
    attempt: (details) => {
      attempts.push(details);
      return details.attempt;
    },
  });
  assert.equal(controller.start().state, 'waiting');
  assert.deepEqual(attempts, [{ attempt: 1, delayMs: 100 }]);
  controller.fail(new Error('connection lost'));
  assert.equal(controller.state.state, 'waiting');
  assert.equal(controller.state.delayMs, 200);
  clock.runNext();
  assert.deepEqual(attempts, [
    { attempt: 1, delayMs: 100 },
    { attempt: 2, delayMs: 200 },
  ]);
  controller.fail(new Error('still offline'));
  assert.equal(controller.state.state, 'exhausted');
});

test('reconnect controller cancellation prevents a pending retry', () => {
  const clock = fakeTimers();
  let calls = 0;
  const controller = createReconnectController({
    policy: createReconnectPolicy({ maxAttempts: 3, baseDelayMs: 50, jitter: 0 }),
    setTimeoutFn: clock.setTimeoutFn,
    clearTimeoutFn: clock.clearTimeoutFn,
    attempt: () => {
      calls += 1;
    },
  });
  controller.start();
  controller.fail(new Error('offline'));
  controller.cancel();
  clock.runNext();
  assert.equal(calls, 1);
  assert.equal(controller.state.state, 'cancelled');
});

test('reconnect controller success clears pending work and can restart', () => {
  const clock = fakeTimers();
  let calls = 0;
  const controller = createReconnectController({
    setTimeoutFn: clock.setTimeoutFn,
    clearTimeoutFn: clock.clearTimeoutFn,
    attempt: () => {
      calls += 1;
    },
  });
  controller.start();
  controller.fail(new Error('offline'));
  controller.succeed('connected');
  clock.runNext();
  assert.equal(calls, 1);
  assert.equal(controller.state.state, 'succeeded');
  assert.equal(controller.start().state, 'waiting');
  assert.equal(calls, 2);
});
test('reconnect controller schedules a failed asynchronous attempt', async () => {
  const clock = fakeTimers();
  const controller = createReconnectController({
    policy: createReconnectPolicy({ maxAttempts: 2, baseDelayMs: 10, jitter: 0 }),
    setTimeoutFn: clock.setTimeoutFn,
    clearTimeoutFn: clock.clearTimeoutFn,
    attempt: async () => {
      throw new Error('offline');
    },
  });
  controller.start();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(controller.state.state, 'waiting');
  assert.equal(controller.state.attempt, 2);
});
