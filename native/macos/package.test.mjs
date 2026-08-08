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
