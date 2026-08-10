import assert from 'node:assert/strict';
import test from 'node:test';
import {createAudioCapturePlan, createAudioEncoderPlan, createAudioPublisher, createAudioPublisherPlan, createRtpAudioPublisher, listAudioBackends, listAudioCaptureDevices, normalizeAudioCapabilities, parseAudioCaptureDevices, validateAudioPermission} from './audio.mjs';

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

test('audio capture and encoder plans preserve the explicit FFmpeg executable', () => {
  const command = '/opt/spartan/bin/ffmpeg-wrapper';
  const capture = createAudioCapturePlan({platform: 'linux', backend: 'pipewire', source: 'default', environment: {XDG_RUNTIME_DIR: '/run/user/1000', SPARTAN_FFMPEG_COMMAND: command}});
  assert.equal(capture.process.executable, command);
  assert.equal(createAudioEncoderPlan({ffmpegCommand: command}).process.executable, command);
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

test('audio encoder plans are shell-free and match captured PCM parameters', () => { const plan = createAudioEncoderPlan({codec: 'opus', channels: 2, sampleRate: 48000}); assert.equal(plan.process.shell, false); assert.equal(plan.output.container, 'ogg-opus'); assert.deepEqual(plan.process.args.slice(0, 13), ['-hide_banner', '-loglevel', 'warning', '-f', 'f32le', '-ar', '48000', '-ac', '2', '-i', 'pipe:0', '-c:a', 'libopus']); assert.deepEqual(plan.process.args.slice(-7), ['-frame_duration', '20', '-f', 'opus', '-page_duration', '20000', 'pipe:1']); });

test('audio publisher forwards bounded encoded chunks and tears down cleanly', async () => {
  const output = {listeners: new Set(), on(type, handler) { if (type === 'data') this.listeners.add(handler); }, off(type, handler) { if (type === 'data') this.listeners.delete(handler); }, emit(value) { for (const handler of this.listeners) handler(value); }};
  let started = 0; let stopped = 0; const chunks = []; const pipeline = {audioOutput: output, async start() { started += 1; }, async stop() { stopped += 1; }};
  const publisher = createAudioPublisher({pipeline, permissionGranted: true, sink: {write: chunk => chunks.push(chunk)}}); await publisher.start(); output.emit(Buffer.from('audio')); await publisher.stop();
  assert.equal(started, 1); assert.equal(stopped, 1); assert.deepEqual(chunks, [Buffer.from('audio')]); assert.equal(publisher.bytesWritten, 5); assert.equal(publisher.state, 'stopped');
});

test('RTP audio publisher delegates packetization and transport delivery', async () => {
  const output = {listeners: new Set(), on(type, handler) { if (type === 'data') this.listeners.add(handler); }, off(type, handler) { if (type === 'data') this.listeners.delete(handler); }, emit(value) { for (const handler of this.listeners) handler(value); }};
  const pipeline = {audioOutput: output, async start() {}, async stop() {}}; const transport = {packets: [], send(packet) { this.packets.push(packet); }}; const packetizer = {push(chunk, metadata) { return [{chunk, timestamp: metadata.timestamp}]; }};
  const result = createRtpAudioPublisher({pipeline, packetizer, transport, permissionGranted: true}); await result.publisher.start(); output.emit(Buffer.from('voice')); output.emit(Buffer.from('voice-2')); await result.publisher.stop();
  assert.equal(result.packetsSent, 2); assert.deepEqual(transport.packets[0].chunk, Buffer.from('voice')); assert.equal(transport.packets[0].timestamp, 0); assert.equal(transport.packets[1].timestamp, 960);
});

test('RTP audio publisher extracts fragmented Opus packets from FFmpeg Ogg output', async () => {
  const output = {listeners: new Set(), on(type, handler) { if (type === 'data') this.listeners.add(handler); }, off(type, handler) { if (type === 'data') this.listeners.delete(handler); }, emit(value) { for (const handler of this.listeners) handler(value); }};
  const page = (packets, continued = false) => { const laces = packets.map(packet => packet.length); const header = Buffer.alloc(27 + laces.length); header.write('OggS'); header[5] = continued ? 1 : 0; header[26] = laces.length; Buffer.from(laces).copy(header, 27); return Buffer.concat([header, ...packets]); };
  const ogg = page([Buffer.from('OpusHead\x01'), Buffer.from('OpusTags'), Buffer.from([0xf8, 0xff, 0xfe])]); const frames = [];
  const result = createRtpAudioPublisher({pipeline: {audioOutput: output, async start() {}, async stop() {}}, packetizer: {push(frame, metadata) { frames.push({frame, timestamp: metadata.timestamp}); return [{frame}]; }}, transport: {send() {}}, permissionGranted: true, container: 'ogg-opus'});
  await result.publisher.start(); output.emit(ogg.subarray(0, 19)); output.emit(ogg.subarray(19)); await result.publisher.stop();
  assert.deepEqual(frames, [{frame: Buffer.from([0xf8, 0xff, 0xfe]), timestamp: 0}]);
});

test('audio publisher requires explicit capture permission', () => {
  assert.throws(() => createAudioPublisher({pipeline: {start() {}, stop() {}}, sink: {write() {}}}), /permission/);
});

test('audio device enumeration parses pactl sources and hides loopback monitors by default', () => {
  const output = '0\talsa_output.pci-0000_00_1f.3.analog-stereo.monitor\tmodule-alsa-card.c\tRUNNING\n1\talsa_input.pci-0000_00_1f.3.analog-stereo\tmodule-alsa-card.c\tRUNNING\n2\talsa_input.usb-046d_C922_Pro_Stream_Webcam\tmodule-alsa-card.c\tSUSPENDED\n';
  const devices = listAudioCaptureDevices({platform: 'linux', backend: 'pipewire', run: () => output});
  assert.deepEqual(devices.map(device => device.id), ['alsa_input.pci-0000_00_1f.3.analog-stereo', 'alsa_input.usb-046d_C922_Pro_Stream_Webcam']);
  assert.equal(devices[0].kind, 'capture');
  assert.equal(devices[0].state, 'RUNNING');
  const withMonitors = listAudioCaptureDevices({platform: 'linux', backend: 'pulse', run: () => output, includeMonitors: true});
  assert.equal(withMonitors[0].kind, 'monitor');
  assert.deepEqual(parseAudioCaptureDevices(output, 'pipewire')[0], {id: 'alsa_output.pci-0000_00_1f.3.analog-stereo.monitor', label: 'Alsa Output Pci 0000 00 1f 3 Analog Stereo Monitor', kind: 'monitor', state: 'RUNNING'});
});

test('audio device enumeration parses AVFoundation and DirectShow listings', () => {
  const avfoundation = '[AVFoundation input device at index 0]\n    Built-in Microphone\n[AVFoundation input device at index 1]\n    Built-in Input\n';
  assert.deepEqual(listAudioCaptureDevices({platform: 'darwin', backend: 'coreaudio', run: (command, args) => { assert.equal(command, 'ffmpeg'); assert.deepEqual(args, ['-f', 'avfoundation', '-list_devices', 'true', '-i', '']); return avfoundation; }}), [{id: '0', label: 'Built-in Microphone', kind: 'microphone'}, {id: '1', label: 'Built-in Input', kind: 'microphone'}]);
  const dshow = '[dshow @ 0x55] DirectShow video devices\n[dshow @ 0x55]  "OBS Virtual Camera"\n[dshow @ 0x55] DirectShow audio devices\n[dshow @ 0x55]  "Microphone (Realtek High Definition Audio)"\n';
  assert.deepEqual(listAudioCaptureDevices({platform: 'win32', backend: 'wasapi', run: () => dshow}), [{id: 'audio=Microphone (Realtek High Definition Audio)', label: 'Microphone (Realtek High Definition Audio)', kind: 'microphone'}]);
});

test('audio device enumeration fails closed when no probe is available', () => {
  assert.deepEqual(listAudioCaptureDevices({platform: 'linux', backend: 'pipewire', run: () => null}), []);
  assert.deepEqual(listAudioCaptureDevices({platform: 'linux', backend: 'pipewire'}), []);
  assert.deepEqual(listAudioCaptureDevices({platform: 'unsupported', backend: 'pipewire', run: () => '0\tname\tmodule\tRUNNING'}), []);
});
