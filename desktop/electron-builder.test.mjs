import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

test('Electron package configuration targets every desktop operating system', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const config = await readFile(path.join(root, 'desktop/electron-builder.yml'), 'utf8');
  assert.match(config, /AppImage/);
  assert.match(config, /dmg/);
  assert.match(config, /nsis/);
  assert.match(config, /desktop\/electron/);
  assert.match(config, /src\/frontend/);
});
