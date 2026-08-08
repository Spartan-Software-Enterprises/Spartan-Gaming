import assert from 'node:assert/strict';
import test from 'node:test';
import {canSelectAudioOutput, listAudioOutputDevices, normalizeAudioOutputDevice, selectAudioOutput} from './audio-output.mjs';

test('audio output normalization keeps only bounded, deduplicated output devices', async () => {
  assert.equal(normalizeAudioOutputDevice({kind: 'audioinput', deviceId: 'mic'}), null);
  const devices = await listAudioOutputDevices({mediaDevices: {enumerateDevices: async () => [
    {kind: 'audiooutput', deviceId: 'default', label: ''},
    {kind: 'audiooutput', deviceId: 'speakers', label: 'Speakers'},
    {kind: 'audiooutput', deviceId: 'speakers', label: 'Duplicate'},
    {kind: 'videoinput', deviceId: 'camera', label: 'Camera'},
  ]}});
  assert.deepEqual(devices.map(device => [device.deviceId, device.label]), [['default', 'Audio output 1'], ['speakers', 'Speakers']]);
});

test('audio output selection is capability-gated and delegates to setSinkId', async () => {
  const calls = []; const video = {async setSinkId(deviceId) { calls.push(deviceId); }};
  assert.equal(canSelectAudioOutput(video), true); assert.equal(await selectAudioOutput(video, 'headphones'), 'headphones'); assert.deepEqual(calls, ['headphones']);
  assert.equal(await selectAudioOutput(video, ''), ''); await assert.rejects(() => selectAudioOutput({}, 'default'), /unavailable/); await assert.rejects(() => selectAudioOutput(video, 'x'.repeat(513)), /too long/);
});

test('audio output listing degrades to an empty device list when enumeration is unavailable', async () => {
  assert.equal(canSelectAudioOutput({}), false); assert.deepEqual(await listAudioOutputDevices({mediaDevices: {}}), []);
});
