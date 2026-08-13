import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {createAppBundlePlan, parseAppPackageArgs, buildAppBundle, createInstallerPlan, executeInstallerPlan} from './package.mjs';

async function fixtureRoot() {
  const root = await fs.mkdtemp(join(tmpdir(), 'spartan-app-'));
  await fs.mkdir(join(root, 'host'), {recursive: true});
  await fs.writeFile(join(root, 'host', 'app-host.mjs'), 'export const runtime = true;\n');
  await fs.mkdir(join(root, 'scripts', 'frontend'), {recursive: true});
  await fs.writeFile(join(root, 'scripts', 'frontend', 'serve.mjs'), 'export const serve = true;\n');
  await fs.mkdir(join(root, 'src', 'frontend', 'adapters'), {recursive: true});
  await fs.writeFile(join(root, 'src', 'frontend', 'adapters', 'manifest-registry.mjs'), 'export const registry = true;\n');
  await fs.mkdir(join(root, 'src', 'frontend', 'launch'), {recursive: true});
  await fs.writeFile(join(root, 'src', 'frontend', 'launch', 'intent.mjs'), 'export const intent = true;\n');
  await fs.mkdir(join(root, 'out', 'spartan-frontend'), {recursive: true});
  await fs.writeFile(join(root, 'out', 'spartan-frontend', 'index.html'), '<html></html>');
  await fs.mkdir(join(root, 'seed'), {recursive: true});
  await fs.writeFile(join(root, 'seed', 'feed.json'), '{}');
  await fs.mkdir(join(root, 'vendor', 'emulators'), {recursive: true});
  await fs.writeFile(join(root, 'vendor', 'emulators', 'runtime-manifest.json'), '{"runtimes":[]}');
  await fs.mkdir(join(root, 'native'), {recursive: true});
  await fs.writeFile(join(root, 'native', 'spartan-native-linux.node'), 'native');
  return root;
}

test('app package plan resolves runtime inputs for every platform', () => {
  for (const platform of ['linux', 'darwin', 'win32']) {
    const plan = createAppBundlePlan({platform, sourceRoot: '/tmp', frontendDir: '/tmp/frontend', seedDir: '/tmp/seed', installers: ['portable']});
    assert.equal(plan.platform, platform);
    assert.ok(plan.bundle.includes(platform));
    assert.ok(plan.payload.runtime.length >= 3);
    assert.deepEqual(plan.installers, ['portable']);
  }
});

test('app bundle assembles runtime, frontend, emulator runtimes, seed, addon, manifest, and launcher', async () => {
  const root = await fixtureRoot();
  try {
    const plan = createAppBundlePlan({platform: 'linux', sourceRoot: root, frontendDir: join(root, 'out/spartan-frontend'), seedDir: join(root, 'seed'), emulatorDir: join(root, 'vendor/emulators'), nativeAddon: join(root, 'native/spartan-native-linux.node'), installers: ['portable']});
    const summary = await buildAppBundle(plan);
    assert.ok(summary.bundle.includes('linux'));
    const manifest = JSON.parse(await fs.readFile(join(plan.bundle, 'spartan-app.json'), 'utf8'));
    assert.equal(manifest.platform, 'linux');
    assert.equal(manifest.seedRoot, 'seed');
    assert.equal(manifest.emulatorRoot, 'emulators');
    assert.equal(manifest.nativeAddon, 'native/spartan-native-linux.node');
    await fs.access(join(plan.bundle, 'host/app-host.mjs'));
    await fs.access(join(plan.bundle, 'scripts/frontend/serve.mjs'));
    await fs.access(join(plan.bundle, 'src/frontend/adapters/manifest-registry.mjs'));
    await fs.access(join(plan.bundle, 'public/index.html'));
    await fs.access(join(plan.bundle, 'seed/feed.json'));
    await fs.access(join(plan.bundle, 'emulators/runtime-manifest.json'));
    await fs.access(join(plan.bundle, 'native/spartan-native-linux.node'));
    const launcher = await fs.readFile(join(plan.bundle, 'spartan-gaming'), 'utf8');
    assert.ok(launcher.includes('desktop-shell.mjs'));
    assert.ok(launcher.includes('seed'));
  } finally { await fs.rm(root, {recursive: true, force: true}); }
});

test('linux deb installer plan uses dpkg-deb and writes a control package', async () => {
  const root = await fixtureRoot();
  try {
    const plan = createAppBundlePlan({platform: 'linux', sourceRoot: root, frontendDir: join(root, 'out/spartan-frontend'), seedDir: join(root, 'seed'), installers: ['portable', 'deb']});
    await buildAppBundle(plan);
    const installers = createInstallerPlan(plan);
    assert.equal(installers.length, 2);
    assert.deepEqual(installers.map(entry => entry.kind), ['portable', 'deb']);
    const results = await executeInstallerPlan(installers, plan);
    const deb = results.find(entry => entry.kind === 'deb');
    assert.ok(deb, 'deb installer produced');
    await fs.access(plan.spec.portable);
    await fs.access(deb.target);
  } finally { await fs.rm(root, {recursive: true, force: true}); }
});

test('darwin and win32 produce portable bundles plus platform installer specs', async () => {
  const root = await fixtureRoot();
  try {
    for (const [platform, expectedSpec] of [['darwin', 'dmg-spec'], ['win32', 'exe-spec']]) {
      const plan = createAppBundlePlan({platform, sourceRoot: root, frontendDir: join(root, 'out/spartan-frontend'), seedDir: join(root, 'seed'), installers: ['portable', expectedSpec]});
      await buildAppBundle(plan);
      const installers = createInstallerPlan(plan);
      assert.deepEqual(installers.map(entry => entry.kind), ['portable', expectedSpec]);
      const results = await executeInstallerPlan(installers, plan);
      const specResult = results.find(entry => entry.kind === expectedSpec);
      const spec = JSON.parse(await fs.readFile(specResult.target, 'utf8'));
      assert.equal(spec.platform, platform);
    }
  } finally { await fs.rm(root, {recursive: true, force: true}); }
});

test('app package CLI requires a known platform and installer', () => {
  const options = parseAppPackageArgs(['--platform', 'windows', '--installer', 'deb']);
  assert.equal(options.platform, 'windows');
  assert.deepEqual(options.installers, ['deb']);
  assert.throws(() => createAppBundlePlan({platform: 'plan9', sourceRoot: '/tmp', frontendDir: '/tmp/f'}), /unsupported/);
  assert.throws(() => createAppBundlePlan({platform: 'linux', sourceRoot: '/tmp', frontendDir: '/tmp/f', installers: ['msi']}), /unsupported linux installer/);
});
