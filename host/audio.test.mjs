import assert from 'node:assert/strict';
import test from 'node:test';
import {createAudioCapturePlan, createAudioPublisherPlan, listAudioBackends, normalizeAudioCapabilities, validateAudioPermission} from './audio.mjs';

test('audio backend matrix covers Windows, macOS, and Linux', () => {
  assert.deepEqual(listAudioBackends('win32').map(item => item.backend), ['wasapi']);
  assert.deepEqual(listAudioBackends('darwin').map(item => item.backend), ['coreaudio']);
  assert.deepEqual(listAudioBackends('linux').map(item => item.backend), ['pipewire', 'pulse']);
});

test('audio capture plans validate permissions and remain shell-free', () => {
  assert.equal(validateAudioPermission({platform: 'darwin', backend: 'coreaudio'}).allowed, false);
  const plan = createAudioCapturePlan({platform: 'linux', backend: 'pipewire', source: 'default', environment: {WAYLAND_DISPLAY: 'wayland-0'}, channels: 2});
  assert.equal(plan.permission.allowed, true);
  assert.equal(plan.process.shell, false);
  assert.equal(plan.output.requiresPublisher, true);
});

test('audio publisher plans bound codec bitrate and capabilities', () => {
  const capture = createAudioCapturePlan({platform: 'win32', backend: 'wasapi', source: 'default', environment: {microphoneGranted: true}});
  const publisher = createAudioPublisherPlan({capturePlan: capture, bitrateKbps: 9999});
  assert.equal(publisher.state, 'plan-only');
  assert.equal(publisher.bitrateKbps, 512);
  const capabilities = normalizeAudioCapabilities({state: 'ready', codecs: ['invalid', 'opus'], channels: 99});
  assert.deepEqual(capabilities.codecs, ['opus']);
  assert.equal(capabilities.channels, 8);
});
