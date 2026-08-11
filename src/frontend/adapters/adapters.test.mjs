import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogAdapterRegistry, resolveLaunchPlan } from './adapters.mjs';
import { createAdapterManifestRegistry } from './manifest-registry.mjs';
import './manager.test.mjs';

const cloud = {
  id: 'cloud',
  name: 'Cloud',
  backendType: 'provider',
  integrationModes: ['browser-first', 'official-launch'],
  url: 'https://example.test',
  requirements: ['account'],
  capabilities: ['gamepad'],
};
const emulator = {
  id: 'emu',
  name: 'Emu',
  backendType: 'emulator',
  mode: 'browser-or-native',
  integrationModes: ['browser-or-native'],
  capabilities: ['gamepad'],
};
const browserGame = {
  id: 'web-game',
  name: 'Web Game',
  backendType: 'game',
  kind: 'browser-game',
  integrationModes: ['browser-first'],
  url: 'https://example.test/game',
  requirements: [],
  capabilities: ['keyboard'],
};

test('provider launch plans prefer an official browser handoff', () => {
  const plan = resolveLaunchPlan(cloud);
  assert.equal(plan.action, 'open-url');
  assert.equal(plan.url, cloud.url);
  assert.deepEqual(plan.requirements, ['account']);
});
test('browser-game launch plans open the official game URL without pretending to host content', () => {
  const plan = resolveLaunchPlan(browserGame);
  assert.equal(plan.action, 'open-url');
  assert.equal(plan.url, browserGame.url);
  assert.equal(plan.kind, 'web-game');
  assert.equal(plan.readiness.status, 'ready');
});
test('emulator plans expose runtime choice instead of pretending to launch', () => {
  const plan = resolveLaunchPlan(emulator);
  assert.equal(plan.action, 'choose-runtime');
  assert.equal(plan.external, false);
});
test('unsupported modes return a structured support error', () => {
  const plan = resolveLaunchPlan({ ...cloud, integrationModes: ['private-api'] });
  assert.equal(plan.status, 'unsupported');
  assert.equal(plan.action, 'show-support-error');
});
test('catalog adapter registry resolves immutable descriptors', () => {
  const registry = createCatalogAdapterRegistry([cloud, emulator]);
  assert.equal(registry.list().length, 2);
  assert.equal(registry.get('cloud').resolve().backendId, 'cloud');
  assert.equal(Object.isFrozen(registry.get('cloud')), true);
});
test('provider launch plans honor saved official launch preferences', () => {
  const plan = resolveLaunchPlan(
    { ...cloud, integrationModes: ['browser-first', 'official-launch'] },
    { providerProfile: { launchMode: 'official' } },
  );
  assert.equal(plan.mode, 'official-launch');
  assert.equal(plan.integration.controllerProfile, 'Auto-detect');
});
test('launch plans expose capability readiness and a concrete next action', () => {
  const plan = resolveLaunchPlan(cloud, {
    providerProfile: { report: { input: { gamepad: false }, transports: { webrtc: true } } },
  });
  assert.equal(plan.readiness.status, 'browser-capability-missing');
  assert.equal(plan.readiness.nextAction, 'run-diagnostics');
  assert.deepEqual(plan.readiness.missingCapabilities, ['gamepad']);
  assert.equal(plan.readiness.issues[0].key, 'gamepad');
});
test('native emulator plans explain adapter readiness without claiming a launch', () => {
  const plan = resolveLaunchPlan(
    {
      id: 'pcsx2',
      name: 'PCSX2',
      backendType: 'emulator',
      mode: 'native',
      integrationModes: ['native'],
      systems: ['playstation-2'],
      license: 'GPL-3.0-or-later',
    },
    {
      providerProfile: { report: { graphics: { webgpuAdapter: true }, input: { gamepad: true } } },
    },
  );
  assert.equal(plan.action, 'configure-native-adapter');
  assert.equal(plan.readiness.status, 'native-adapter-required');
  assert.equal(plan.readiness.nextAction, 'choose-runtime');
  assert.equal(plan.readiness.issues[0].key, 'firmware');
});
test('catalog adapter registry can read a live capability report', () => {
  let report = { input: { gamepad: false }, transports: { webrtc: true } };
  const registry = createCatalogAdapterRegistry(
    [{ ...cloud, requirements: ['provider-account'] }],
    { report: () => report },
  );
  assert.equal(registry.get('cloud').resolve().readiness.status, 'browser-capability-missing');
  report = { input: { gamepad: true }, transports: { webrtc: true } };
  assert.equal(registry.get('cloud').resolve().readiness.status, 'configuration-required');
});
test('native emulator plans expose signed adapter readiness when a manifest registry is supplied', () => {
  const manifestRegistry = createAdapterManifestRegistry({
    platform: 'linux',
    records: [
      {
        id: 'pcsx2',
        version: '1.0.0',
        kind: 'emulator',
        status: 'installed',
        trust: 'signed',
        platforms: ['linux'],
        capabilities: ['video'],
        license: 'GPL-3.0-or-later',
        integrity: 'sha256-pcsx2',
        signature: { algorithm: 'ECDSA-P256-SHA256', signer: 'release', value: 'sig' },
      },
    ],
  });
  const plan = resolveLaunchPlan(
    {
      id: 'pcsx2',
      name: 'PCSX2',
      backendType: 'emulator',
      mode: 'native',
      integrationModes: ['native'],
      systems: ['playstation-2'],
      license: 'GPL-3.0-or-later',
    },
    { providerProfile: { adapterRegistry: manifestRegistry, platform: 'linux' } },
  );
  assert.equal(plan.integration.adapter.status, 'ready');
});
test('provider embed plans require a configured official target and use its generated URL', () => {
  const twitch = {
    id: 'twitch',
    name: 'Twitch',
    backendType: 'provider',
    integrationModes: ['official-embed', 'browser-first'],
    capabilities: ['video', 'chat'],
    url: 'https://www.twitch.tv/',
  };
  const plan = resolveLaunchPlan(twitch, {
    allowedModes: ['official-embed', 'browser-first'],
    providerProfile: { embedTarget: 'twitchdev', embedParent: 'gaming.example' },
  });
  assert.equal(plan.action, 'embed-url');
  assert.match(plan.url, /player\.twitch\.tv/);
  const fallback = resolveLaunchPlan(twitch, { allowedModes: ['official-embed', 'browser-first'] });
  assert.equal(fallback.action, 'open-url');
});
