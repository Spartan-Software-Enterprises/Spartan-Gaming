import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import test from 'node:test';

const installRoot = process.env.SPARTAN_NATIVE_MACOS_INSTALL || path.resolve('out/native-macos/install');

test('built macOS package exposes the universal input binding shape', async t => {
  if (process.platform !== 'darwin') { t.skip('macOS package contract runs on macOS'); return; }
  let module;
  try { module = await import(pathToFileURL(path.join(installRoot, 'index.mjs')).href); }
  catch (error) { t.skip(`macOS package is not built in this environment: ${error.message}`); return; }
  const bindings = await module.createBindings();
  assert.equal(bindings.platform, 'darwin');
  assert.equal(bindings.capabilities.keyboard, true);
  assert.equal(bindings.capabilities.pointer, true);
  assert.equal(bindings.capabilities.rumble, true);
  assert.equal(typeof bindings.capture.start, 'function');
  assert.equal(typeof bindings.audio.start, 'function');
  assert.equal(typeof bindings.input.execute, 'function');
  await bindings.close?.();
});

test('macOS native input contract preserves frontend pointer button transitions', async () => {
  const source = await (await import('node:fs/promises')).readFile(new URL('./src/bindings.mm', import.meta.url), 'utf8');
  assert.match(source, /kCGEventLeftMouseDown/);
  assert.match(source, /kCGEventRightMouseUp/);
  assert.match(source, /CGEventCreateScrollWheelEvent/);
  assert.match(source, /kVK_RightCommand/);
  assert.match(source, /kVK_F12/);
  assert.match(source, /kVK_ForwardDelete/);
  assert.match(source, /kVK_ANSI_0/);
  assert.match(source, /pointer:cancel/);
});

test('macOS native input contract maps browser punctuation codes', async () => {
  const source = await (await import('node:fs/promises')).readFile(new URL('./src/bindings.mm', import.meta.url), 'utf8');
  for (const code of ['Comma', 'Period', 'Semicolon', 'Quote', 'Backquote', 'Slash', 'Backslash', 'Minus', 'Equal', 'BracketLeft', 'BracketRight']) assert.match(source, new RegExp(`"${code}"`));
});

test('macOS native input contract maps numpad and extended function browser codes', async () => {
  const source = await (await import('node:fs/promises')).readFile(new URL('./src/bindings.mm', import.meta.url), 'utf8');
  for (const code of ['Numpad0', 'Numpad9', 'NumpadDecimal', 'NumpadAdd', 'NumpadSubtract', 'NumpadMultiply', 'NumpadDivide', 'NumpadEnter', 'NumLock', 'F13', 'F20']) assert.match(source, new RegExp(`"${code}"`));
});

test('macOS native input contract marks unsupported operations as soft errors', async () => {
  const source = await (await import('node:fs/promises')).readFile(new URL('./src/bindings.mm', import.meta.url), 'utf8');
  assert.match(source, /napi_throw_error\(env, "ERR_UNSUPPORTED_INPUT", message\)/);
  assert.match(source, /unsupported\(env, "unsupported macOS CGEvent key"\)/);
  assert.match(source, /unsupported\(env, "unsupported macOS mouse button event"\)/);
});
