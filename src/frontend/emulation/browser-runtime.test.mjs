import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserEmulatorRuntime} from './browser-runtime.mjs';

function adapter() { const calls = []; return {id: 'test-wasm', calls, supports: core => core.id === 'libretro', async load(value) { calls.push(['load', value]); }, async start() { calls.push(['start']); }, async pause() { calls.push(['pause']); }, async resume() { calls.push(['resume']); }, async reset() { calls.push(['reset']); }, async input(value) { calls.push(['input', value]); }, async saveState() { calls.push(['save']); return new Uint8Array([1, 2]); }, async loadState(value) { calls.push(['loadState', value]); }, async stop() { calls.push(['stop']); }}; }
const core = {id: 'libretro', mode: 'browser-or-native', license: 'per-core'};
const game = {id: 'game:demo:1:1', name: 'demo.rom', kind: 'game', userSelected: true};
const source = {name: 'demo.rom', size: 1, async arrayBuffer() { return new ArrayBuffer(0); }};

test('browser emulator runtime validates files and manages the full lifecycle', async () => {
  const impl = adapter(); const states = []; const runtime = createBrowserEmulatorRuntime({adapter: impl, canvas: {id: 'canvas'}}); runtime.on('state', state => states.push(state));
  await assert.rejects(() => runtime.load({core, gameFile: {...game, userSelected: false}}), /explicitly selected/);
  await runtime.load({core, gameFile: game, settings: {renderer: 'Metal', shaderPreset: 'CRT scanlines', integerScaling: false}}); assert.equal(runtime.state, 'ready'); assert.deepEqual(impl.calls[0][1].settings, {renderer: 'Metal', shaderPreset: 'CRT scanlines', integerScaling: false}); await runtime.start(); await runtime.input({type: 'button', action: 'confirm'}); await runtime.pause(); await runtime.resume(); await runtime.reset(); const save = await runtime.saveState(); assert.deepEqual([...save], [1, 2]); const saveSource = {name: 'slot.state', size: 2, async arrayBuffer() { return new Uint8Array([1, 2]); }}; await runtime.loadState({id: 'save:slot-1', name: 'slot.state', kind: 'save', userSelected: true, source: saveSource}); assert.equal(impl.calls.at(-1)[1].source, saveSource); await runtime.stop(); assert.equal(runtime.state, 'stopped'); assert.deepEqual(impl.calls.map(call => call[0]), ['load', 'start', 'input', 'pause', 'resume', 'reset', 'save', 'loadState', 'stop']); assert.deepEqual(states, ['loading', 'ready', 'running', 'paused', 'running', 'ready', 'stopped']);
});

test('browser emulator runtime forwards the selected source only to the adapter boundary', async () => { const impl = adapter(); const runtime = createBrowserEmulatorRuntime({adapter: impl}); const selected = {...game, source}; await runtime.load({core, gameFile: selected}); assert.equal(impl.calls[0][1].gameFile.source, source); assert.equal(Object.keys(impl.calls[0][1].gameFile).includes('source'), false); await runtime.stop(); });

test('browser emulator runtime forwards the WebAssembly threads policy to the adapter', async () => { const impl = adapter(); const runtime = createBrowserEmulatorRuntime({adapter: impl}); await runtime.load({core, gameFile: game, settings: {allowWebAssemblyThreads: false}}); assert.equal(impl.calls[0][1].settings.allowWebAssemblyThreads, false); await runtime.stop(); });

test('browser emulator runtime rejects unsupported cores and adapter failures', async () => {
  const impl = adapter(); const runtime = createBrowserEmulatorRuntime({adapter: impl});
  await assert.rejects(() => runtime.load({core: {id: 'dolphin'}, gameFile: game}), /does not support/);
  const failing = createBrowserEmulatorRuntime({adapter: {id: 'broken', async load() { throw new Error('WASM failed'); }, async start() {}, async stop() {}}});
  await assert.rejects(() => failing.load({core, gameFile: game}), /WASM failed/); assert.equal(failing.state, 'error');
});

test('browser emulator runtime requires a concrete lifecycle adapter', () => {
  assert.throws(() => createBrowserEmulatorRuntime(), /adapter is required/);
  assert.throws(() => createBrowserEmulatorRuntime({adapter: {id: 'missing-load'}}), /must provide load/);
});
