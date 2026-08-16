import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeBrowserHostConfig,
  resolveBrowserHostMediaPreferences,
} from './browser-studio.mjs';

test('browser host studio normalizes connection and capture fields without persistence', () => {
  assert.deepEqual(
    normalizeBrowserHostConfig({
      endpoint: ' wss://relay.example/signal ',
      sessionId: ' ses-1 ',
      ticket: ' ticket ',
      hostId: '',
      hostName: '',
      audio: true,
      microphone: true,
      microphoneDeviceId: ' mic-1 ',
      microphoneNoiseSuppression: false,
      displaySurface: 'window',
      framerate: 300,
    }),
    {
      endpoint: 'wss://relay.example/signal',
      sessionId: 'ses-1',
      ticket: 'ticket',
      hostId: 'browser-host',
      hostName: 'Browser Host',
      audio: true,
      microphone: true,
      microphoneDeviceId: 'mic-1',
      microphoneNoiseSuppression: false,
      microphoneNoiseSuppressionProfile: 'off',
      displaySurface: 'window',
      framerate: 240,
    },
  );
  assert.equal(
    normalizeBrowserHostConfig({ displaySurface: 'invalid', framerate: 0 }).displaySurface,
    'monitor',
  );
  assert.equal(
    normalizeBrowserHostConfig({ displaySurface: 'invalid', framerate: 0 }).framerate,
    60,
  );
});
test('browser host media preferences never grant microphone permission implicitly', () => {
  assert.deepEqual(
    resolveBrowserHostMediaPreferences({
      'media.audioInput': 'No microphone',
      'media.micNoiseSuppression': false,
    }),
    {
      audioInput: 'No microphone',
      microphoneNoiseSuppression: false,
      microphoneNoiseSuppressionProfile: 'off',
    },
  );
  assert.equal(
    resolveBrowserHostMediaPreferences({ 'media.audioInput': 'invalid' }).audioInput,
    'System default',
  );
});
test('browser host media preferences honor the noise-suppression profile setting', () => {
  assert.equal(
    resolveBrowserHostMediaPreferences({
      'media.micNoiseSuppression': true,
      'media.micNoiseSuppressionProfile': 'aggressive',
    }).microphoneNoiseSuppressionProfile,
    'aggressive',
  );
  assert.equal(
    resolveBrowserHostMediaPreferences({
      'media.micNoiseSuppression': false,
      'media.micNoiseSuppressionProfile': 'aggressive',
    }).microphoneNoiseSuppressionProfile,
    'off',
  );
  assert.equal(
    resolveBrowserHostMediaPreferences({ 'media.micNoiseSuppression': true })
      .microphoneNoiseSuppressionProfile,
    'basic',
  );
  assert.equal(
    normalizeBrowserHostConfig({
      microphoneNoiseSuppression: false,
      microphoneNoiseSuppressionProfile: 'ml',
    }).microphoneNoiseSuppressionProfile,
    'off',
  );
});
