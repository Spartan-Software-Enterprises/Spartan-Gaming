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
