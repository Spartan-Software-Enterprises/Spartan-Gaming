import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyNetworkHealth, createQualityController, normalizeHealthTelemetry} from './quality.mjs';

test('health telemetry is bounded and normalized', () => { const health = normalizeHealthTelemetry({rttMs: -4, packetLossPct: 120, frameDrops: 2.8, timestamp: 'now'}); assert.equal(health.rttMs, 0); assert.equal(health.packetLossPct, 100); assert.equal(health.frameDrops, 2); });
test('network health classification identifies degradation', () => { assert.equal(classifyNetworkHealth({rttMs: 240}), 'poor'); assert.equal(classifyNetworkHealth({packetLossPct: 2.5}), 'fair'); assert.equal(classifyNetworkHealth({rttMs: 30}), 'good'); });
test('quality controller downgrades quickly and upgrades with hysteresis', () => { const controller = createQualityController({initialProfile: 'balanced', upgradeAfter: 2}); assert.equal(controller.profile.id, 'balanced'); assert.equal(controller.ingest({packetLossPct: 8}).profile.id, 'low'); assert.equal(controller.ingest({rttMs: 20}).changed, false); assert.equal(controller.ingest({rttMs: 20}).profile.id, 'balanced'); assert.equal(controller.request().type, 'quality.request'); });
