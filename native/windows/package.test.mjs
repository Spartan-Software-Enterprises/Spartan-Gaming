import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import test from 'node:test';

const installRoot = process.env.SPARTAN_NATIVE_WINDOWS_INSTALL || path.resolve('out/native-windows/install');

test('built Windows package exposes the universal input binding shape', async t => {
  if (process.platform !== 'win32') { t.skip('Windows package contract runs on Windows'); return; }
  let module;
  try { module = await import(pathToFileURL(path.join(installRoot, 'index.mjs')).href); }
  catch (error) { t.skip(`Windows package is not built in this environment: ${error.message}`); return; }
  const bindings = await module.createBindings();
  assert.equal(bindings.platform, 'win32');
  assert.equal(bindings.capabilities.keyboard, true);
  assert.equal(bindings.capabilities.pointer, true);
  assert.equal(bindings.capabilities.rumble, true);
  assert.equal(typeof bindings.capture.start, 'function');
  assert.equal(typeof bindings.audio.start, 'function');
  assert.equal(typeof bindings.input.execute, 'function');
  await bindings.close?.();
});

test('Windows native input contract preserves frontend pointer button transitions', async () => {
  const source = await (await import('node:fs/promises')).readFile(new URL('./src/bindings.cpp', import.meta.url), 'utf8');
  assert.match(source, /MOUSEEVENTF_LEFTDOWN/);
  assert.match(source, /MOUSEEVENTF_RIGHTUP/);
  assert.match(source, /MOUSEEVENTF_WHEEL/);
  assert.match(source, /VK_LCONTROL/);
  assert.match(source, /VK_F12/);
  assert.match(source, /pointer:cancel/);
});

test('Windows native input contract maps browser punctuation codes', async () => {
  const source = await (await import('node:fs/promises')).readFile(new URL('./src/bindings.cpp', import.meta.url), 'utf8');
  for (const code of ['Comma', 'Period', 'Semicolon', 'Quote', 'Backquote', 'Slash', 'Backslash', 'Minus', 'Equal', 'BracketLeft', 'BracketRight']) assert.match(source, new RegExp(`"${code}"`));
});

test('Windows native input contract maps numpad and system browser codes', async () => {
  const source = await (await import('node:fs/promises')).readFile(new URL('./src/bindings.cpp', import.meta.url), 'utf8');
  for (const code of ['Numpad0', 'Numpad9', 'NumpadDecimal', 'NumpadAdd', 'NumpadSubtract', 'NumpadMultiply', 'NumpadDivide', 'NumpadEnter', 'NumLock', 'PrintScreen', 'ScrollLock', 'Pause', 'ContextMenu', 'F13', 'F24', 'IntlRo', 'IntlYen', 'IntlBackslash']) assert.match(source, new RegExp(`"${code}"`));
});

test('Windows native input contract marks unsupported operations as soft errors', async () => {
  const source = await (await import('node:fs/promises')).readFile(new URL('./src/bindings.cpp', import.meta.url), 'utf8');
  assert.match(source, /napi_throw_error\(env, "ERR_UNSUPPORTED_INPUT", message\)/);
  assert.match(source, /unsupported\(env, "unsupported Windows SendInput key"\)/);
  assert.match(source, /unsupported\(env, "unsupported Windows mouse button event"\)/);
});
