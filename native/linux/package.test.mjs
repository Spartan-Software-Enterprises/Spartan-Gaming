import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {pathToFileURL} from 'node:url';
import {composeLinuxInput} from './index.mjs';

const installRoot = process.env.SPARTAN_NATIVE_LINUX_INSTALL || path.resolve('out/native-linux/install');

test('Linux native input composes uinput gamepad events with reference keyboard and pointer events', async () => {
  const calls = [];
  const reference = {input: {execute: async operation => calls.push(['reference', operation.kind]), close() { calls.push(['reference', 'close']); }}, capabilities: {input: true, keyboard: true, pointer: true, rumble: false, technologies: {}}};
  const native = {input: {execute: async operation => calls.push(['native', operation.kind]), close() { calls.push(['native', 'close']); }}, capabilities: {gamepad: true, rumble: true}};
  const input = composeLinuxInput({reference, native});
  await input.execute({kind: 'key'}); await input.execute({kind: 'pointer'}); await input.execute({kind: 'button'}); await input.execute({kind: 'axis'}); await input.execute({kind: 'rumble'}); input.close();
  assert.deepEqual(calls, [['reference', 'key'], ['reference', 'pointer'], ['native', 'button'], ['native', 'axis'], ['native', 'rumble'], ['native', 'close'], ['reference', 'close']]);
});

test('Linux native package accepts the shared frontend button and axis control vocabulary', async () => {
  const calls = [];
  const reference = {input: {execute: async operation => calls.push(['reference', operation.kind])}, capabilities: {input: true, keyboard: true, pointer: true, rumble: false, technologies: {}}};
  const native = {input: {execute: async operation => calls.push(['native', operation.control])}, capabilities: {gamepad: true, rumble: true}};
  const input = composeLinuxInput({reference, native});
  await input.execute({kind: 'button', control: 'button-0'});
  await input.execute({kind: 'axis', control: 'axis-0', value: -1});
  assert.deepEqual(calls, [['native', 'button-0'], ['native', 'axis-0']]);
});

test('Linux native package contract covers the complete standard Gamepad button index range', async () => {
  const source = await (await import('node:fs/promises')).readFile(new URL('./src/bindings.cpp', import.meta.url), 'utf8');
  assert.match(source, /BTN_TL2/);
  assert.match(source, /BTN_TR2/);
  assert.match(source, /BTN_THUMBL/);
  assert.match(source, /BTN_THUMBR/);
  assert.match(source, /BTN_DPAD_RIGHT/);
  assert.match(source, /button-/);
});

test('built Linux package exposes the universal binding shape and uinput capability', async t => {
  let module;
  try { module = await import(pathToFileURL(path.join(installRoot, 'index.mjs')).href); }
  catch (error) { t.skip(`Linux package is not built in this environment: ${error.message}`); return; }
  const bindings = await module.createBindings({environment: {DISPLAY: ':1'}, spawnProbe: () => ({status: 1})});
  assert.equal(bindings.platform, 'linux');
  assert.equal(typeof bindings.input.execute, 'function');
  assert.equal(typeof bindings.input.close, 'function');
  assert.equal(typeof bindings.capabilities.input, 'boolean');
  assert.equal(typeof bindings.capabilities.gamepad, 'boolean');
  assert.equal(typeof bindings.capabilities.rumble, 'boolean');
  if (bindings.capabilities.rumble) assert.equal(bindings.capabilities.gamepad, true);
  await bindings.close();
});
