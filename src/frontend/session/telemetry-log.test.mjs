import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSessionDiagnosticsBundle,
  createSessionTelemetryLog,
  normalizeTelemetrySample,
  serializeSessionDiagnostics,
} from './telemetry-log.mjs';

test('session telemetry log is bounded, numeric, and privacy-gated', () => {
  let tick = 0;
  const log = createSessionTelemetryLog({ maxSamples: 2, clock: () => `t-${++tick}` });
  log.add({ rttMs: 12, packetLossPct: 140, decodeFps: 999 });
  log.add({ rttMs: 20 });
  log.add({ rttMs: 30 });
  assert.equal(log.list().length, 2);
  assert.equal(log.list()[0].rttMs, 20);
  assert.equal(log.list()[1].packetLossPct, null);
  log.setEnabled(false);
  assert.equal(log.list().length, 0);
  assert.equal(log.add({ rttMs: 1 }), null);
});
test('session diagnostics bundle omits identity and credential-bearing fields', () => {
  const bundle = createSessionDiagnosticsBundle({
    session: {
      id: 'secret-session',
      backendId: 'spartan-host',
      backendType: 'remote-play',
      endpoint: 'wss://private.example',
      quality: 'balanced',
    },
    negotiated: { transports: ['webrtc'], video: { codec: 'vp9' }, audio: { codec: 'opus' } },
    samples: [{ rttMs: 24 }],
    adjustments: ['codec VP9'],
  });
  assert.equal(bundle.session.backendId, 'spartan-host');
  assert.equal(Object.hasOwn(bundle.session, 'id'), false);
  assert.equal(Object.hasOwn(bundle.session, 'endpoint'), false);
  assert.match(serializeSessionDiagnostics(bundle), /"version": 1/);
});
test('telemetry sample normalization clamps unsafe values', () => {
  const sample = normalizeTelemetrySample({ rttMs: -4, packetLossPct: 500, decodeFps: 'bad' });
  assert.deepEqual(sample, {
    timestamp: sample.timestamp,
    rttMs: 0,
    packetLossPct: 100,
    decodeFps: null,
    framesDropped: null,
    jitterMs: null,
    bitrateKbps: null,
  });
});
