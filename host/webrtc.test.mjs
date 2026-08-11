import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detectWebRtcAdapters,
  listWebRtcAdapters,
  selectWebRtcAdapter,
  webRtcReadiness,
} from './webrtc.mjs';

test('WebRTC adapter detection stays optional and reports available implementations', async () => {
  const adapters = await detectWebRtcAdapters({
    loader: async (packageName) =>
      packageName === 'werift' ? { name: packageName } : Promise.reject(new Error('not installed')),
  });
  assert.deepEqual(
    listWebRtcAdapters().map((adapter) => adapter.id),
    ['node-datachannel', 'werift'],
  );
  assert.equal(adapters.find((adapter) => adapter.id === 'werift').state, 'available');
  assert.equal(adapters.find((adapter) => adapter.id === 'node-datachannel').state, 'unavailable');
  assert.equal(selectWebRtcAdapter(adapters, ['werift']).id, 'werift');
  assert.deepEqual(webRtcReadiness(adapters), { ready: true, available: ['werift'], requires: [] });
});

test('WebRTC readiness reports the install requirement when no adapter is present', async () => {
  const adapters = await detectWebRtcAdapters({
    loader: async () => {
      throw new Error('missing');
    },
  });
  assert.equal(selectWebRtcAdapter(adapters), null);
  assert.deepEqual(webRtcReadiness(adapters), {
    ready: false,
    available: [],
    requires: ['optional-webrtc-adapter'],
  });
});
