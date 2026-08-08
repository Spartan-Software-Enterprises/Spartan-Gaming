import assert from 'node:assert/strict';
import test from 'node:test';
import {createPlatformRuntimePlans} from './platform-runtime.mjs';
import {createExecutablePlatformHost, createExecutablePlatformHostFromInstalledAdapter} from './executable-platform-host.mjs';

function stream() { return {listeners: new Set(), on(type, handler) { if (type === 'data') this.listeners.add(handler); }, off(type, handler) { if (type === 'data') this.listeners.delete(handler); }, emit(value) { for (const handler of this.listeners) handler(value); }}; }
function pipeline() { return {videoOutput: stream(), audioOutput: stream(), async start() {}, async stop() {}}; }

test('executable platform host delivers media packets and permissioned input through one session', async () => { const plans = createPlatformRuntimePlans({platform: 'linux', environment: {DISPLAY: ':0.0'}, includeAudio: false}); const nativePipeline = pipeline(); const packets = []; const operations = []; const host = createExecutablePlatformHost({platform: 'linux', plans, pipeline: nativePipeline, packetizer: {push: (chunk, metadata) => [{chunk, timestamp: metadata.timestamp}]}, transport: {send: packet => packets.push(packet)}, inputAdapter: {platform: 'linux', execute: async operation => operations.push(operation)}, permissions: {'virtual-gamepad': true}}); await host.session.start(); nativePipeline.videoOutput.emit(Buffer.from('frame')); await host.session.dispatchInput({type: 'input.event', action: 'jump', kind: 'button', control: 'a', pressed: true, source: 'gamepad'}); assert.equal(packets.length, 1); assert.equal(packets[0].timestamp, 0); assert.equal(operations[0].control, 'a'); await host.session.stop(); });
test('executable platform host rejects mismatched plan platforms before creating processes', () => { const plans = createPlatformRuntimePlans({platform: 'darwin', environment: {microphoneGranted: true, screenRecordingGranted: true}, includeAudio: false}); assert.throws(() => createExecutablePlatformHost({platform: 'win32', plans, packetizer: {push: () => []}, transport: {send() {}}}), /match/); });
test('executable platform host can bind input through a ready platform adapter boundary', async () => { const plans = createPlatformRuntimePlans({platform: 'linux', environment: {DISPLAY: ':0.0'}, includeAudio: false}); const operations = []; let closed = 0; const host = createExecutablePlatformHost({platform: 'linux', plans, pipeline: pipeline(), packetizer: {push: () => []}, transport: {send() {}}, adapterBoundary: {invoke: async (kind, operation, value) => { assert.equal(kind, 'input'); if (operation === 'execute') operations.push(value); if (operation === 'close') closed += 1; }}, permissions: {'virtual-gamepad': true}}); await host.session.start(); await host.session.dispatchInput({type: 'input.event', action: 'jump', kind: 'button', control: 'a', pressed: true, source: 'gamepad'}); await host.session.stop(); assert.equal(operations[0].control, 'a'); assert.equal(closed, 1); });
test('installed adapter host factory verifies selection before starting the session', async () => {
  const plans = createPlatformRuntimePlans({platform: 'linux', environment: {DISPLAY: ':0.0'}, includeAudio: false});
  const calls = [];
  const registry = {get: kind => ({kind, state: 'ready', id: 'linux-input'})};
  const adapterRuntime = {
    createBoundary: async ({kind}) => {
      assert.equal(kind, 'input');
      return {
        manifest: {id: 'linux-input', version: '1.0.0'},
        adapter: {platform: 'linux', execute: async operation => calls.push(operation), close() {}},
        boundary: {invoke: async (adapterKind, operation, value) => { assert.equal(adapterKind, 'input'); if (operation === 'execute') calls.push(value); }},
      };
    },
  };
  const host = await createExecutablePlatformHostFromInstalledAdapter({platform: 'linux', plans, pipeline: pipeline(), packetizer: {push: () => []}, transport: {send() {}}, adapterRuntime, adapterRegistry: registry, permissions: {'virtual-gamepad': true}});
  await host.session.start();
  await host.session.dispatchInput({type: 'input.event', action: 'jump', kind: 'button', control: 'a', pressed: true, source: 'gamepad'});
  await host.session.stop();
  assert.equal(calls[0].control, 'a');
  assert.equal(host.installedAdapter.manifest.id, 'linux-input');
});
test('executable platform host publishes permissioned audio in the same lifecycle', async () => {
  const plans = createPlatformRuntimePlans({platform: 'linux', environment: {WAYLAND_DISPLAY: 'wayland-0', XDG_RUNTIME_DIR: '/run/user/1000'}, includeAudio: true});
  const nativeAudioPipeline = pipeline(); const packets = [];
  const host = createExecutablePlatformHost({platform: 'linux', plans, pipeline: pipeline(), audioPipeline: nativeAudioPipeline, packetizer: {push: () => []}, transport: {send() {}}, audioPacketizer: {push: (chunk, metadata) => [{chunk, timestamp: metadata.timestamp}]}, audioTransport: {send: packet => packets.push(packet)}, permissions: {microphone: true}});
  await host.session.start(); nativeAudioPipeline.audioOutput.emit(Buffer.from('audio')); await host.session.stop(); assert.equal(packets.length, 1); assert.equal(host.audioPublisher.publisher.state, 'stopped');
});
