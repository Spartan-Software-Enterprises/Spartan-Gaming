import assert from 'node:assert/strict';
import test from 'node:test';
import { createHostSignalingClient } from './signaling.mjs';

class FakeWebSocket {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.sent = [];
    FakeWebSocket.instances.push(this);
  }
  send(value) {
    this.sent.push(JSON.parse(value));
  }
  close() {
    this.onclose?.({ code: 1000 });
  }
  open() {
    this.onopen?.();
  }
  message(value) {
    this.onmessage?.({ data: JSON.stringify(value) });
  }
}

test('host signaling client authenticates its host join and routes messages', async () => {
  FakeWebSocket.instances.length = 0;
  const received = [];
  const closed = [];
  const client = createHostSignalingClient({
    endpoint: 'ws://localhost:8790/signal',
    sessionId: 'ses-host-01',
    ticket: 'ticket-01',
    WebSocketImpl: FakeWebSocket,
    onMessage: (message) => received.push(message),
    onClose: (event) => closed.push(event.code),
  });
  const pending = client.connect();
  const socket = FakeWebSocket.instances[0];
  socket.open();
  await pending;
  assert.equal(client.state, 'open');
  assert.deepEqual(socket.sent[0], {
    type: 'signaling.join',
    sessionId: 'ses-host-01',
    role: 'host',
    ticket: 'ticket-01',
  });
  client.send({ protocol: 'spartan-gaming/1', type: 'session.answer' });
  assert.equal(socket.sent[1].type, 'session.answer');
  socket.message({ protocol: 'spartan-gaming/1', type: 'session.offer' });
  assert.equal(received[0].type, 'session.offer');
  client.close();
  assert.deepEqual(closed, [1000]);
});

test('host signaling client rejects non-WebSocket endpoints', () => {
  assert.throws(
    () =>
      createHostSignalingClient({
        endpoint: 'https://localhost:8790/signal',
        sessionId: 'ses-host-02',
        ticket: 'ticket',
      }),
    /ws or wss/,
  );
});
