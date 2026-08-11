import assert from 'node:assert/strict';
import test from 'node:test';
import { createReadinessStatus, statusClass } from './status.mjs';

const compatibility = (counts) => ({ counts });
const report = { graphics: { webgl: true } };

test('readiness status progresses from loading to actionable setup and ready', () => {
  assert.equal(createReadinessStatus().id, 'loading');
  assert.equal(createReadinessStatus({ catalogLoaded: true }).id, 'loading');
  assert.equal(
    createReadinessStatus({
      catalogLoaded: true,
      compatibility: compatibility({ 'configuration-required': 2 }),
      capabilityReport: report,
    }).id,
    'attention',
  );
  assert.equal(
    createReadinessStatus({
      catalogLoaded: true,
      compatibility: compatibility({ 'native-adapter-required': 1 }),
      capabilityReport: report,
    }).id,
    'degraded',
  );
  assert.equal(
    createReadinessStatus({
      catalogLoaded: true,
      compatibility: compatibility({}),
      capabilityReport: report,
    }).id,
    'ready',
  );
});

test('session and offline states take precedence over catalog readiness', () => {
  const base = { catalogLoaded: true, compatibility: compatibility({}), capabilityReport: report };
  assert.equal(createReadinessStatus({ ...base, online: false }).label, 'Offline mode');
  assert.equal(createReadinessStatus({ ...base, activeSession: 'connecting' }).id, 'connecting');
  assert.equal(createReadinessStatus({ ...base, activeSession: 'connected' }).id, 'connected');
  assert.equal(createReadinessStatus({ ...base, activeSession: 'error' }).id, 'error');
  assert.equal(statusClass({ ...base, activeSession: 'connected' }), 'status-connected');
});
