import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {createNativeClientDiscovery} from './native-client-discovery.mjs';

test('native client discovery finds and misses official client executables', async () => {
  const root = await mkdtemp(join(tmpdir(), 'spartan-client-'));
  try {
    await writeFile(join(root, 'steam'), '#!/bin/sh');
    const discovery = createNativeClientDiscovery({platform: 'linux', baseDirs: [root]});
    const found = await discovery.discover('steam-remote-play');
    assert.equal(found.found, true); assert.equal(found.path, join(root, 'steam')); assert.equal(found.checked, true);
    const missing = await discovery.discover('parsec');
    assert.equal(missing.found, false); assert.equal(missing.checked, true);
    const unsupported = await discovery.discover('amazon-luna');
    assert.equal(unsupported.found, false); assert.equal(unsupported.checked, false);
  } finally { await rm(root, {recursive: true, force: true}); }
});
