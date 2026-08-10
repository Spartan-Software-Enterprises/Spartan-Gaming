import assert from 'node:assert/strict';
import test from 'node:test';
import {verifyDesktopCapabilities} from './verify-desktop-capabilities.mjs';

test('desktop capability verification is observation-only and reports a ready injected package', async () => {
  const calls = [];
  const report = await verifyDesktopCapabilities({platform: 'win32', installRoot: '/opt/spartan/native', loadModule: async specifier => { assert.match(specifier, /index\.mjs$/); return {createBindings: async options => { calls.push(options); return {capabilities: {keyboard: true, pointer: true, rumble: true}, input: {execute() {}}, capture: {start() {}}, audio: {start() {}}, close() { calls.push('closed'); }}; }}; }});
  assert.equal(report.status, 'ready'); assert.equal(report.package.state, 'ready'); assert.equal(report.virtualGamepad.state, 'external-driver-required'); assert.equal(calls.at(-1), 'closed');
  assert.equal(report.capabilities.input.state, 'ready'); assert.equal(report.capabilities.audio.state, 'ready'); assert.equal(report.capabilities.haptics.state, 'ready');
});

test('desktop capability verification can explicitly exercise capture, audio, input, and haptics', async () => {
  const calls = []; const lifecycle = name => ({async start(options) { calls.push([name, 'start', options]); }, async stop() { calls.push([name, 'stop']); }});
  const report = await verifyDesktopCapabilities({platform: 'win32', execute: true, delay: async () => {}, environment: {SPARTAN_HARDWARE_CAPTURE_SOURCE: 'display-1', SPARTAN_HARDWARE_AUDIO_SOURCE: 'mic-1'}, loadModule: async () => ({createBindings: async () => ({capabilities: {input: true, audio: true, rumble: true}, input: {async execute(operation) { calls.push(['input', operation]); }}, capture: lifecycle('capture'), audio: lifecycle('audio'), close() { calls.push(['bindings', 'close']); }})})});
  assert.equal(report.status, 'ready'); assert.deepEqual(report.execution, {state: 'ready', capture: 'verified', audio: 'verified', input: 'verified', haptics: 'verified'});
  assert.deepEqual(calls.filter(call => call[0] === 'input').map(call => call[1]), [{kind: 'key', control: 'F20', pressed: true}, {kind: 'key', control: 'F20', pressed: false}, {kind: 'rumble', gamepadIndex: 0, strongMagnitude: 0.25, weakMagnitude: 0.15, durationMs: 250}]); assert.equal(calls.at(-1)[0], 'bindings');
});

test('desktop capability verification separates missing audio and haptics from input readiness', async () => {
  const report = await verifyDesktopCapabilities({platform: 'win32', loadModule: async () => ({createBindings: async () => ({capabilities: {input: true, audio: false, rumble: false}, input: {execute() {}}, capture: {start() {}}, audio: {}, close() {}})})});
  assert.equal(report.capabilities.input.state, 'ready'); assert.equal(report.capabilities.audio.state, 'unavailable'); assert.equal(report.capabilities.haptics.state, 'unavailable');
});

test('desktop capability verification reports missing Linux uinput without claiming readiness', async () => {
  const report = await verifyDesktopCapabilities({platform: 'linux', installRoot: '/opt/spartan/native', access: async () => { throw new Error('missing'); }, loadModule: async () => ({createBindings: async () => ({capabilities: {virtualGamepad: true}, input: {execute() {}}, capture: {start() {}}, audio: {start() {}}, close() {}})})});
  assert.equal(report.status, 'unavailable'); assert.equal(report.hardware.state, 'unavailable'); assert.equal(report.virtualGamepad.state, 'unavailable');
});

test('desktop capability verification rejects unsupported platforms', async () => {
  await assert.rejects(() => verifyDesktopCapabilities({platform: 'android'}), /unsupported desktop platform/);
});

test('desktop capability verification accepts Windows and macOS aliases', async () => {
  const paths = []; const loadModule = async specifier => { paths.push(specifier); return {createBindings: async () => ({capabilities: {}, input: {execute() {}}, capture: {start() {}}, audio: {start() {}}, close() {}})}; };
  assert.equal((await verifyDesktopCapabilities({platform: 'windows', loadModule})).platform, 'win32');
  assert.equal((await verifyDesktopCapabilities({platform: 'macos', loadModule})).platform, 'darwin');
  assert.match(paths[0], /out\/native-windows\/install\/index\.mjs$/); assert.match(paths[1], /out\/native-macos\/install\/index\.mjs$/);
});
