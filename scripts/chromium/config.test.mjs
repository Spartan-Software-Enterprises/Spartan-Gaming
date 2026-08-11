import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  loadChromiumManifest,
  parseGnArgs,
  validateChromiumManifest,
  validateGnArgsFile,
} from '../../chromium/config.mjs';

test('Chromium manifest covers universal desktop targets without vendoring source', () => {
  const manifest = loadChromiumManifest();
  assert.equal(validateChromiumManifest(manifest), true);
  assert.equal(manifest.checkout.managedOutsideRepository, true);
  assert.deepEqual(
    manifest.targets.map((target) => target.id),
    ['linux', 'mac', 'windows'],
  );
});

test('GN templates contain safe development defaults', () => {
  for (const platform of ['linux', 'mac', 'windows']) {
    const args = validateGnArgsFile(`chromium/args/${platform}.gn`);
    assert.equal(args.is_official_build, 'false');
    assert.equal(args.is_component_build, 'true');
  }
});

test('GN parser ignores comments and rejects unsupported assignments', () => {
  assert.deepEqual(parseGnArgs('# comment\nis_official_build = false\nsymbol_level = 1'), {
    is_official_build: 'false',
    symbol_level: '1',
  });
  assert.throws(() => parseGnArgs('exec = "rm -rf out"'), /unsupported GN key/);
  assert.ok(fs.existsSync('chromium/args/linux.gn'));
});
