import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {pathToFileURL} from 'node:url';

const installRoot = process.env.SPARTAN_NATIVE_LINUX_INSTALL || path.resolve('out/native-linux/install');

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
