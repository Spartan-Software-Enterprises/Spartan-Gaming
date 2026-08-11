import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createUnsignedNativePackageManifest } from './release-manifest.mjs';

test('native rollout manifest deterministically describes install files without claiming a signature', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'spartan-native-manifest-'));
  try {
    await mkdir(path.join(root, 'host'));
    await writeFile(path.join(root, 'index.mjs'), 'export const platform = "linux";\n');
    await writeFile(path.join(root, 'host', 'runtime.mjs'), 'export {};\n');
    const output = path.join(root, '..', `${path.basename(root)}.json`);
    const manifest = await createUnsignedNativePackageManifest({
      installRoot: root,
      platform: 'linux',
      version: 'build-123',
      outputPath: output,
    });
    assert.equal(manifest.id, 'native-linux');
    assert.equal(manifest.format, 'directory');
    assert.equal(manifest.entrypoint, 'index.mjs');
    assert.equal(manifest.files[0].path, 'host');
    assert.equal(manifest.files[1].integrity.startsWith('sha256-'), true);
    assert.equal('signature' in manifest, false);
    assert.deepEqual(JSON.parse(await readFile(output, 'utf8')).files, manifest.files);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('native rollout manifest rejects missing package entrypoints', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'spartan-native-manifest-'));
  try {
    await assert.rejects(
      () =>
        createUnsignedNativePackageManifest({
          installRoot: root,
          platform: 'windows',
          version: 'build-123',
        }),
      /index\.mjs/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
