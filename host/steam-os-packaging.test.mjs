import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSteamOsInstallPlan,
  createSteamOsLaunchRegistrationPlan,
  createSteamOsUninstallPlan,
  createSteamOsUpdatePlan,
  normalizeSteamOsPackagingProfile,
} from './steam-os-packaging.mjs';

test('SteamOS packaging profile is user-scoped and immutable-host safe', () => {
  const profile = normalizeSteamOsPackagingProfile({ appId: 'com.spartan.gaming' });
  assert.equal(profile.installScope, 'user');
  assert.equal(profile.dataRoot, '~/.var/app/com.spartan.gaming');
  assert.equal(profile.immutableHostSafe, true);
  assert.throws(
    () => normalizeSteamOsPackagingProfile({ installScope: 'system' }),
    /user installation/,
  );
});

test('SteamOS install plans require consent and a verified digest', () => {
  const profile = normalizeSteamOsPackagingProfile();
  assert.throws(
    () =>
      createSteamOsInstallPlan({
        profile,
        artifactPath: '/tmp/spartan.flatpak',
        artifactSha256: 'a'.repeat(64),
      }),
    /consent/,
  );
  const plan = createSteamOsInstallPlan({
    profile,
    artifactPath: '/tmp/spartan.flatpak',
    artifactSha256: 'A'.repeat(64),
    consentGiven: true,
  });
  assert.deepEqual(plan.process.args, ['--user', 'install', '--bundle', '/tmp/spartan.flatpak']);
  assert.equal(plan.process.shell, false);
  assert.equal(plan.artifactSha256, 'a'.repeat(64));
});

test('SteamOS updates expose commit-pinned rollback and consent-gated removal', () => {
  const profile = normalizeSteamOsPackagingProfile();
  const update = createSteamOsUpdatePlan({ profile, consentGiven: true });
  const rollback = createSteamOsUpdatePlan({ profile, commit: 'ABCDEF12', consentGiven: true });
  const uninstall = createSteamOsUninstallPlan({ profile, deleteData: true, consentGiven: true });
  assert.deepEqual(update.process.args, ['--user', 'update', 'com.spartan.gaming']);
  assert.deepEqual(rollback.process.args, [
    '--user',
    'update',
    '--commit=abcdef12',
    'com.spartan.gaming',
  ]);
  assert.equal(rollback.kind, 'steamos-flatpak-rollback');
  assert.deepEqual(uninstall.process.args, [
    '--user',
    'uninstall',
    '--delete-data',
    'com.spartan.gaming',
  ]);
});

test('SteamOS packaging exposes consent-gated desktop and Steam non-Steam registration metadata', () => {
  const profile = normalizeSteamOsPackagingProfile();
  assert.throws(
    () => createSteamOsLaunchRegistrationPlan({ profile, consentGiven: false }),
    /consent/,
  );
  const desktop = createSteamOsLaunchRegistrationPlan({
    profile,
    consentGiven: true,
    arguments: ['--profile', 'deck'],
  });
  assert.equal(desktop.desktopEntry.Exec, 'flatpak run com.spartan.gaming --profile deck');
  assert.equal(desktop.steamNonSteamHandoff, false);
  const steam = createSteamOsLaunchRegistrationPlan({
    profile,
    mode: 'steam-non-steam',
    consentGiven: true,
  });
  assert.equal(steam.steamNonSteamHandoff, true);
  assert.ok(steam.requires.includes('operator-steam-non-steam-registration'));
});
