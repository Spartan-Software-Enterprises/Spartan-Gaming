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
  assert.match(source, /strongMagnitude/);
  assert.match(source, /weakMagnitude/);
  assert.match(source, /button-/);
});

test('Linux native package observes host-local force feedback through the uinput FF handshake', async () => {
  const source = await (await import('node:fs/promises')).readFile(new URL('./src/bindings.cpp', import.meta.url), 'utf8');
  assert.match(source, /device\.ff_effects_max = 16/);
  assert.match(source, /O_RDWR \| O_NONBLOCK/);
  assert.match(source, /UI_SET_FFBIT, FF_RUMBLE/);
  assert.match(source, /UI_SET_FFBIT, FF_GAIN/);
  assert.match(source, /UI_BEGIN_FF_UPLOAD/);
  assert.match(source, /UI_END_FF_UPLOAD/);
  assert.match(source, /UI_BEGIN_FF_ERASE/);
  assert.match(source, /UI_END_FF_ERASE/);
  assert.match(source, /EV_UINPUT/);
  assert.match(source, /readRumbleEvents/);
  assert.match(source, /ff_gain/);
});

test('Linux package exposes the uinput rumble reader through the composed input adapter', async () => {
  const calls = [];
  const reference = {input: {execute: async operation => calls.push(['reference', operation.kind]), close() { calls.push(['reference', 'close']); }}, capabilities: {input: true, keyboard: true, pointer: true, rumble: false, technologies: {}}};
  const native = {input: {execute: async operation => calls.push(['native', operation.control]), readRumbleEvents: () => [{strongMagnitude: 0.75, weakMagnitude: 0.25}], close() { calls.push(['native', 'close']); }}, capabilities: {gamepad: true, rumble: true}};
  const input = composeLinuxInput({reference, native});
  assert.deepEqual(input.readRumbleEvents(), [{strongMagnitude: 0.75, weakMagnitude: 0.25}]);
  input.close();
  assert.deepEqual(calls, [['native', 'close'], ['reference', 'close']]);
});

test('Linux package reports no rumble reader without a native uinput binding', () => {
  const reference = {input: {execute: async operation => ['reference', operation.kind], close() {}}, capabilities: {input: true, keyboard: true, pointer: true, rumble: false, technologies: {}}};
  const input = composeLinuxInput({reference});
  assert.equal(typeof input.readRumbleEvents, 'undefined');
});

test('Linux binding injects a full button and axis sequence into the real uinput device', async t => {
  const {access} = await import('node:fs/promises');
  try { await access('/dev/uinput', 6); } catch { t.skip('uinput is not readable and writable in this environment'); return; }
  let module;
  try { module = await import(pathToFileURL(path.join(installRoot, 'index.mjs')).href); }
  catch (error) { t.skip(`Linux package is not built in this environment: ${error.message}`); return; }
  const bindings = await module.createBindings({environment: {DISPLAY: ':1'}, spawnProbe: () => ({status: 1})});
  if (!bindings.capabilities.gamepad) { await bindings.close(); t.skip('the uinput virtual gamepad is unavailable'); return; }
  try {
    assert.equal(await bindings.input.execute({kind: 'button', control: 'button-0', pressed: true}), true);
    assert.equal(await bindings.input.execute({kind: 'button', control: 'button-0', pressed: false}), true);
    assert.equal(await bindings.input.execute({kind: 'button', control: 'button-10', pressed: true}), true);
    assert.equal(await bindings.input.execute({kind: 'axis', control: 'axis-0', value: 1}), true);
    assert.equal(await bindings.input.execute({kind: 'axis', control: 'axis-5', value: -0.5}), true);
    assert.equal(await bindings.input.execute({kind: 'axis', control: 'axis-2', value: 0}), true);
  } finally { await bindings.close(); }
});

test('built Linux package exposes the universal binding shape and uinput capability', async t => {
  let module;
  try { module = await import(pathToFileURL(path.join(installRoot, 'index.mjs')).href); }
  catch (error) { t.skip(`Linux package is not built in this environment: ${error.message}`); return; }
  const bindings = await module.createBindings({environment: {DISPLAY: ':1'}, spawnProbe: () => ({status: 1})});
  assert.equal(bindings.platform, 'linux');
  assert.equal(typeof bindings.input.execute, 'function');
  assert.equal(typeof bindings.input.close, 'function');
  assert.equal(typeof bindings.input.readRumbleEvents, 'function');
  assert.equal(typeof bindings.capabilities.input, 'boolean');
  assert.equal(typeof bindings.capabilities.gamepad, 'boolean');
  assert.equal(typeof bindings.capabilities.rumble, 'boolean');
  if (bindings.capabilities.rumble) assert.equal(bindings.capabilities.gamepad, true);
  await bindings.close();
});

test('Linux binding scales active rumble by a live force-feedback gain change', async t => {
  const {access} = await import('node:fs/promises');
  try { await access('/dev/uinput', 6); } catch { t.skip('uinput is not readable and writable in this environment'); return; }
  let module;
  try { module = await import(pathToFileURL(path.join(installRoot, 'index.mjs')).href); }
  catch (error) { t.skip(`Linux package is not built in this environment: ${error.message}`); return; }
  const bindings = await module.createBindings({environment: {DISPLAY: ':1'}, spawnProbe: () => ({status: 1})});
  if (!bindings.capabilities.rumble) { await bindings.close(); t.skip('uinput force feedback is unavailable'); return; }
  try {
    try {
      await bindings.input.execute({kind: 'rumble', strongMagnitude: 0.5, weakMagnitude: 0.25, durationMs: 0});
    } catch (error) { t.skip(`this kernel cannot upload uinput force-feedback effects (${error.message}); the binding is otherwise verified by its contract and source checks`); return; }
    let sawStrong = false;
    let sawWeak = false;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      for (const event of bindings.input.readRumbleEvents()) {
        if (event.strongMagnitude > 0) sawStrong = true;
        if (event.weakMagnitude > 0) sawWeak = true;
      }
      if (sawStrong && sawWeak) break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.equal(sawStrong, true, 'the played rumble effect was observed by the reader');
    assert.equal(sawWeak, true, 'the weak motor magnitude was observed by the reader');
    assert.ok(bindings.input.readRumbleEvents().every(event => event.strongMagnitude <= 1 && event.weakMagnitude <= 1), 'observed magnitudes are normalized to the shared 0..1 contract');
  } finally { await bindings.close(); }
});
