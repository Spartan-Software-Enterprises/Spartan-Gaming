import assert from 'node:assert/strict';
import test from 'node:test';
import {createBindings} from './reference-adapter.mjs';

function probe() { return {status: 0}; }

for (const platform of ['win32', 'darwin']) {
  test(`${platform} reference package exposes guarded capture and audio lifecycles`, async () => {
    const bindings = await createBindings({platform, environment: {}, spawnProbe: probe});
    assert.equal(bindings.platform, platform);
    assert.equal(bindings.capabilities.capture, true);
    assert.equal(bindings.capabilities.audio, true);
    assert.equal(typeof bindings.capture.start, 'function');
    assert.equal(typeof bindings.audio.start, 'function');
    assert.equal(bindings.capture.plan({permissionGranted: true}).platform, platform);
    assert.equal(bindings.audio.plan({permissionGranted: true}).platform, platform);
    await assert.rejects(() => bindings.capture.start(), /permission/);
    await assert.rejects(() => bindings.audio.start(), /permission/);
    await bindings.close();
  });
}
