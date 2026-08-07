import test from 'node:test';
import assert from 'node:assert/strict';
import {createWebRtcTelemetryCollector, normalizeWebRtcStats} from './telemetry.mjs';

test('WebRTC stats normalize into bounded health telemetry', () => {
  const sample = normalizeWebRtcStats([{type: 'candidate-pair', state: 'succeeded', currentRoundTripTime: 0.042}, {type: 'inbound-rtp', kind: 'video', packetsLost: 2, packetsReceived: 98, framesDecoded: 60, framesDropped: 1, jitter: 0.004, bytesReceived: 5000}], {now: 1000});
  assert.equal(sample.rttMs, 42); assert.equal(sample.packetLossPct, 2); assert.equal(sample.decodeFps, 0); assert.equal(sample.jitterMs, 4); assert.equal(sample.framesDropped, 1);
});

test('WebRTC telemetry collector polls without exposing raw stats', async () => {
  const callbacks = []; let calls = 0; const peer = {async getStats() { calls += 1; return [{type: 'candidate-pair', currentRoundTripTime: 0.05}, {type: 'inbound-rtp', kind: 'video', packetsReceived: calls * 10, framesDecoded: calls * 60}]; }};
  const collector = createWebRtcTelemetryCollector({peerConnection: peer, scheduler: callback => { callbacks.push(callback); return 1; }, clearScheduler: () => {}}); const samples = []; collector.on('health', sample => samples.push(sample)); collector.start(); await new Promise(resolve => setImmediate(resolve)); callbacks[0](); await new Promise(resolve => setImmediate(resolve)); assert.ok(calls >= 2); assert.equal(Object.hasOwn(samples[0], 'ssrc'), false); collector.stop(); assert.equal(collector.running, false);
});
