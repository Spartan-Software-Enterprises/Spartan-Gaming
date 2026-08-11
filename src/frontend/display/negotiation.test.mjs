import assert from 'node:assert/strict';
import test from 'node:test';
import { formatDisplayNegotiation, resolveDisplayNegotiation } from './negotiation.mjs';

test('display outcome reports local target and negotiated HDR/refresh', () => {
  const outcome = resolveDisplayNegotiation({
    preferences: { display: { kind: 'index', index: 1 } },
    requestedCapabilities: { video: { hdr: true, maxFramerate: 144 } },
    negotiatedCapabilities: { video: { hdr: true, maxFramerate: 120 } },
    displayCapabilities: { count: 2 },
  });
  assert.equal(outcome.display.status, 'local-target');
  assert.equal(outcome.hdr.status, 'enabled');
  assert.equal(outcome.refreshRate.status, 'capped');
  assert.equal(formatDisplayNegotiation(outcome), 'Display 2 · HDR enabled · 120 Hz');
});

test('display outcome separates unavailable local targets from host downgrades', () => {
  const outcome = resolveDisplayNegotiation({
    preferences: { display: { kind: 'index', index: 1 } },
    requestedCapabilities: { video: { hdr: true, maxFramerate: 144 } },
    negotiatedCapabilities: { video: { hdr: false, maxFramerate: 60 } },
    displayCapabilities: { count: 1 },
  });
  assert.equal(outcome.display.status, 'unavailable');
  assert.equal(outcome.hdr.status, 'downgraded');
  assert.equal(outcome.refreshRate.status, 'capped');
  assert.match(outcome.summary, /Display 2 unavailable/);
});

test('display outcome remains pending before the host answer', () => {
  const outcome = resolveDisplayNegotiation({
    preferences: { display: 'ask' },
    requestedCapabilities: { video: { hdr: true, maxFramerate: 60 } },
  });
  assert.equal(outcome.display.status, 'selection-required');
  assert.equal(outcome.hdr.status, 'pending');
  assert.equal(outcome.refreshRate.status, 'pending');
});
