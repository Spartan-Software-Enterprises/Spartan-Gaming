import assert from 'node:assert/strict';
import test from 'node:test';
import {verifyDesktopCapabilities} from './verify-desktop-capabilities.mjs';

test('desktop capability verification is observation-only and reports a ready injected package', async () => {
  const calls = [];
  const report = await verifyDesktopCapabilities({platform: 'win32', installRoot: '/opt/spartan/native', loadModule: async specifier => { assert.match(specifier, /index\.mjs$/); return {createBindings: async options => { calls.push(options); return {capabilities: {keyboard: true, pointer: true, rumble: true}, input: {execute() {}}, capture: {start() {}}, audio: {start() {}}, close() { calls.push('closed'); }}; }}; }});
  assert.equal(report.status, 'ready'); assert.equal(report.package.state, 'ready'); assert.equal(report.virtualGamepad.state, 'external-driver-required'); assert.equal(calls.at(-1), 'closed');
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
