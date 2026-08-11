import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

test('desktop update release requires verified tags and platform signing custody', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const workflow = await readFile(
    path.join(root, '.github/workflows/desktop-update-release.yml'),
    'utf8',
  );
  assert.match(workflow, /release_tag:/);
  assert.match(workflow, /git tag --points-at HEAD/);
  assert.match(workflow, /SPARTAN_UPDATE_CHANNEL=\$update_channel/);
  assert.match(workflow, /\*-alpha\.\*/);
  assert.match(workflow, /\*-beta\.\*/);
  assert.match(workflow, /-c\.publish\.channel=/);
  assert.match(workflow, /SPARTAN_WINDOWS_CSC_LINK/);
  assert.match(workflow, /SPARTAN_MAC_CSC_LINK/);
  assert.match(workflow, /SPARTAN_MAC_APP_PASSWORD/);
  assert.match(workflow, /npm ci --ignore-scripts/);
  assert.match(workflow, /npm rebuild electron/);
  assert.match(workflow, /npm run electron:test/);
  assert.match(workflow, /--publish never/);
  assert.match(workflow, /latest-linux\.yml|dist-electron\/\*\.yml/);
  assert.match(workflow, /gh release view/);
  assert.match(workflow, /gh release upload/);
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40} # v7/);
  assert.match(workflow, /actions\/setup-node@[0-9a-f]{40} # v7/);
  assert.match(workflow, /actions\/upload-artifact@[0-9a-f]{40} # v7/);
  assert.match(workflow, /actions\/download-artifact@[0-9a-f]{40} # v7/);
  assert.doesNotMatch(workflow, /uses: actions\/[^@]+@v\d+/);
  assert.doesNotMatch(workflow, /pull_request:/);
  assert.doesNotMatch(workflow, /push:/);
});
