import assert from 'node:assert/strict';
import test from 'node:test';
import { listAudioInputDevices, normalizeAudioInputDevice } from './audio-input.mjs';

test('microphone device normalization filters and deduplicates input devices', async () => {
  assert.equal(normalizeAudioInputDevice({ kind: 'audiooutput', deviceId: 'speaker' }), null);
  const devices = await listAudioInputDevices({
    mediaDevices: {
      enumerateDevices: async () => [
        { kind: 'audioinput', deviceId: 'default', label: '' },
        { kind: 'audioinput', deviceId: 'mic-1', label: 'Desk mic' },
        { kind: 'audioinput', deviceId: 'mic-1', label: 'Duplicate' },
        { kind: 'audiooutput', deviceId: 'speaker', label: 'Speaker' },
      ],
    },
  });
  assert.deepEqual(
    devices.map((device) => [device.deviceId, device.label]),
    [
      ['default', 'Microphone 1'],
      ['mic-1', 'Desk mic'],
    ],
  );
});
