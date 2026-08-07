import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerState, formatLatency, reducePlayerState} from './player-state.mjs';

test('player state tracks session, quality, and telemetry events immutably', () => { let state = createPlayerState(); state = reducePlayerState(state, {type: 'session.state', status: 'connected'}); state = reducePlayerState(state, {type: 'quality.changed', profile: 'low'}); state = reducePlayerState(state, {type: 'telemetry.health', rttMs: 42, packetLossPct: 1.5}); assert.equal(state.status, 'connected'); assert.equal(state.quality, 'low'); assert.equal(state.latencyMs, 42); assert.equal(Object.isFrozen(state), true); });
test('player controls toggle overlays and report errors', () => { let state = createPlayerState(); state = reducePlayerState(state, {type: 'toggle.overlay'}); assert.equal(state.overlayVisible, false); state = reducePlayerState(state, {type: 'error', message: 'Host unavailable'}); assert.equal(state.status, 'error'); assert.equal(state.error, 'Host unavailable'); });
test('player state distinguishes paired control plane from playable media', () => { let state = createPlayerState(); state = reducePlayerState(state, {type: 'media.state', state: 'not-configured'}); assert.equal(state.mediaState, 'not-configured'); state = reducePlayerState(state, {type: 'media.state', state: 'active'}); assert.equal(state.mediaState, 'active'); });
test('latency formatting is safe for missing measurements', () => { assert.equal(formatLatency(undefined), '—'); assert.equal(formatLatency(18.4), '18 ms'); });
