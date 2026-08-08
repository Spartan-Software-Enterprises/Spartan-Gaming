import assert from 'node:assert/strict';
import test from 'node:test';
import {createAudioCapturePlan, createAudioEncoderPlan, createAudioPublisher, createAudioPublisherPlan, createRtpAudioPublisher, listAudioBackends, normalizeAudioCapabilities, validateAudioPermission} from './audio.mjs';

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

test('audio encoder plans are shell-free and match captured PCM parameters', () => { const plan = createAudioEncoderPlan({codec: 'opus', channels: 2, sampleRate: 48000}); assert.equal(plan.process.shell, false); assert.deepEqual(plan.process.args.slice(0, 13), ['-hide_banner', '-loglevel', 'warning', '-f', 'f32le', '-ar', '48000', '-ac', '2', '-i', 'pipe:0', '-c:a', 'libopus']); });

test('audio publisher forwards bounded encoded chunks and tears down cleanly', async () => {
  const output = {listeners: new Set(), on(type, handler) { if (type === 'data') this.listeners.add(handler); }, off(type, handler) { if (type === 'data') this.listeners.delete(handler); }, emit(value) { for (const handler of this.listeners) handler(value); }};
  let started = 0; let stopped = 0; const chunks = []; const pipeline = {audioOutput: output, async start() { started += 1; }, async stop() { stopped += 1; }};
  const publisher = createAudioPublisher({pipeline, permissionGranted: true, sink: {write: chunk => chunks.push(chunk)}}); await publisher.start(); output.emit(Buffer.from('audio')); await publisher.stop();
  assert.equal(started, 1); assert.equal(stopped, 1); assert.deepEqual(chunks, [Buffer.from('audio')]); assert.equal(publisher.bytesWritten, 5); assert.equal(publisher.state, 'stopped');
});

test('RTP audio publisher delegates packetization and transport delivery', async () => {
  const output = {listeners: new Set(), on(type, handler) { if (type === 'data') this.listeners.add(handler); }, off(type, handler) { if (type === 'data') this.listeners.delete(handler); }, emit(value) { for (const handler of this.listeners) handler(value); }};
  const pipeline = {audioOutput: output, async start() {}, async stop() {}}; const transport = {packets: [], send(packet) { this.packets.push(packet); }}; const packetizer = {push(chunk, metadata) { return [{chunk, timestamp: metadata.timestamp}]; }};
  const result = createRtpAudioPublisher({pipeline, packetizer, transport, permissionGranted: true}); await result.publisher.start(); output.emit(Buffer.from('voice')); await result.publisher.stop();
  assert.equal(result.packetsSent, 1); assert.deepEqual(transport.packets[0].chunk, Buffer.from('voice')); assert.equal(transport.packets[0].timestamp, 0);
});

test('audio publisher requires explicit capture permission', () => {
  assert.throws(() => createAudioPublisher({pipeline: {start() {}, stop() {}}, sink: {write() {}}}), /permission/);
});
