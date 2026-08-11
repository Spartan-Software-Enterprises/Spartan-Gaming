import assert from 'node:assert/strict';
import test from 'node:test';
import { createRumbleBroadcastController } from './rumble-passthrough.mjs';

function collectedSessions() {
  const received = [];
  const first = {
    sessionId: 'ses-one',
    send: (envelope) => received.push({ sessionId: 'ses-one', envelope }),
  };
  const second = {
    sessionId: 'ses-two',
    send: (envelope) => received.push({ sessionId: 'ses-two', envelope }),
  };
  return { received, first, second };
}

test('rumble broadcast forwards bounded host rumble to every subscribed session', () => {
  const { received, first, second } = collectedSessions();
  const controller = createRumbleBroadcastController({
    adapter: { readRumbleEvents: () => [{ strongMagnitude: 2, weakMagnitude: -1 }] },
  });
  controller.add(first);
  controller.add(second);
  controller.poll();
  assert.equal(received.length, 2);
  for (const { envelope } of received) {
    assert.equal(envelope.type, 'input.event');
    assert.equal(envelope.payload.source, 'host');
    assert.equal(envelope.payload.kind, 'rumble');
    assert.equal(envelope.payload.strongMagnitude, 1);
    assert.equal(envelope.payload.weakMagnitude, 0);
  }
});

test('rumble broadcast preserves controller slots and enforces controller policy', () => {
  const { received, first } = collectedSessions();
  const controller = createRumbleBroadcastController({
    adapter: {
      readRumbleEvents: () => [
        { index: 1, strongMagnitude: 0.5, weakMagnitude: 0.25 },
        { gamepadIndex: 8, strongMagnitude: 1 },
      ],
    },
    controllerPolicy: { playerSlots: 2, multipleControllers: true },
  });
  controller.add(first);
  controller.poll();
  assert.equal(received.length, 1);
  assert.equal(received[0].envelope.payload.gamepadIndex, 1);
});

test('rumble broadcast defaults adapters without a reported slot to player one', () => {
  const { received, first } = collectedSessions();
  const controller = createRumbleBroadcastController({
    adapter: { readRumbleEvents: () => [{ strongMagnitude: 0.5 }] },
  });
  controller.add(first);
  controller.poll();
  assert.equal(received[0].envelope.payload.gamepadIndex, 0);
});

test('rumble broadcast leaves sessions without a reader idle', () => {
  const { received, first } = collectedSessions();
  let intervalCount = 0;
  const controller = createRumbleBroadcastController({
    adapter: {},
    setIntervalImpl: () => {
      intervalCount += 1;
      return 1;
    },
    clearIntervalImpl: () => {
      intervalCount -= 1;
    },
  });
  controller.attach();
  assert.equal(controller.active, false);
  assert.equal(intervalCount, 0);
  controller.add(first);
  assert.equal(received.length, 0);
});

test('rumble broadcast polls the adapter reader while attached', () => {
  const { received, first } = collectedSessions();
  const reader = { readRumbleEvents: () => [{ strongMagnitude: 0.5, weakMagnitude: 0.25 }] };
  const ticks = [];
  let onTick = null;
  const controller = createRumbleBroadcastController({
    adapter: reader,
    intervalMs: 10,
    setIntervalImpl: (fn) => {
      ticks.push(10);
      onTick = fn;
      return { fn };
    },
    clearIntervalImpl: () => {
      ticks.push('clear');
    },
  });
  controller.add(first);
  controller.attach();
  assert.equal(controller.active, true);
  assert.deepEqual(ticks, [10]);
  onTick();
  assert.equal(received.length, 1);
  assert.equal(received[0].envelope.payload.strongMagnitude, 0.5);
  assert.equal(received[0].envelope.payload.weakMagnitude, 0.25);
  controller.detach();
  assert.equal(controller.active, false);
  assert.deepEqual(ticks, [10, 'clear']);
});

test('rumble broadcast tolerates a failing reader', () => {
  const { received, first } = collectedSessions();
  const controller = createRumbleBroadcastController({
    adapter: {
      readRumbleEvents: () => {
        throw new Error('reader unavailable');
      },
    },
  });
  controller.add(first);
  controller.poll();
  assert.equal(received.length, 0);
});

test('rumble broadcast rejects sessions without send()', () => {
  const controller = createRumbleBroadcastController({ adapter: { readRumbleEvents: () => [] } });
  assert.throws(() => controller.add({ sessionId: 'ses-one' }), /must implement send/);
});

test('rumble broadcast ignores malformed rumble payloads', () => {
  const { received, first } = collectedSessions();
  const controller = createRumbleBroadcastController({
    adapter: { readRumbleEvents: () => [null, { strongMagnitude: 'x' }] },
  });
  controller.add(first);
  controller.poll();
  assert.equal(received.length, 2);
  for (const { envelope } of received) {
    assert.equal(envelope.payload.strongMagnitude, 0);
    assert.equal(envelope.payload.weakMagnitude, 0);
  }
});
