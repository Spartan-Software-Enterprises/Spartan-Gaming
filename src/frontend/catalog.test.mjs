import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createFrontendCatalog, validateCatalogManifest } from './catalog.mjs';

async function load(path) {
  return JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8'));
}

test('provider and emulator manifests compose into one frontend catalog', async () => {
  const providers = await load('providers/catalog.json');
  const emulators = await load('emulators/catalog.json');
  const games = await load('games/catalog.json');
  const providerEntries = validateCatalogManifest(providers, 'provider');
  const emulatorEntries = validateCatalogManifest(emulators, 'emulator');
  const gameEntries = validateCatalogManifest(games, 'game');
  const catalog = createFrontendCatalog({
    providers: providerEntries,
    emulators: emulatorEntries,
    games: gameEntries,
  });

  assert.equal(
    catalog.entries.length,
    providerEntries.length + emulatorEntries.length + gameEntries.length,
  );
  assert.equal(catalog.get('xbox-cloud-gaming').backendType, 'provider');
  assert.ok(providerEntries.length >= 20);
  for (const id of [
    'playstation-plus-cloud',
    'blacknut',
    'antstream',
    'parsec',
    'xbox-remote-play',
    'sunshine-moonlight',
    'spartan-host',
  ])
    assert.equal(catalog.get(id).backendType, 'provider');
  assert.equal(catalog.get('pcsx2').backendType, 'emulator');
  assert.equal(catalog.get('2048').backendType, 'game');
  assert.equal(catalog.get('2048').kind, 'browser-game');
  assert.equal(catalog.get('gamenative').nativeApp.packageName, 'app.gamenative');
  assert.equal(catalog.get('gamenative').nativeApp.license, 'GPL-3.0');
  assert.ok(catalog.find({ backendType: 'provider', capability: 'gamepad' }).length > 0);
  assert.ok(catalog.find({ backendType: 'emulator', supportLevel: 'B' }).length > 0);
  assert.ok(
    catalog
      .find({ backendType: 'emulator' })
      .some((entry) => entry.id === 'pcsx2' && entry.systems.includes('playstation-2')),
  );
});

test('catalog validates browser-game manifests separately from providers and emulators', () => {
  assert.throws(
    () =>
      validateCatalogManifest(
        {
          catalogVersion: 1,
          updatedAt: '2026-08-08',
          games: [
            {
              id: 'unsafe',
              name: 'Unsafe',
              kind: 'not-a-game',
              supportLevel: 'C',
              integrationModes: ['browser-first'],
              url: 'https://example.test',
              requirements: [],
              capabilities: [],
            },
          ],
        },
        'game',
      ),
    /unsupported game kind/,
  );
  assert.throws(
    () =>
      validateCatalogManifest(
        {
          catalogVersion: 1,
          updatedAt: '2026-08-08',
          games: [
            {
              id: 'http-game',
              name: 'HTTP game',
              kind: 'browser-game',
              supportLevel: 'C',
              integrationModes: ['browser-first'],
              url: 'http://example.test',
              requirements: [],
              capabilities: [],
              genres: ['arcade'],
              license: 'Upstream',
            },
          ],
        },
        'game',
      ),
    /must use HTTPS/,
  );
});

test('catalog manifests require valid update dates, HTTPS URLs, and source-local IDs', () => {
  const provider = {
    id: 'provider-one',
    name: 'Provider',
    kind: 'cloud-gaming',
    supportLevel: 'A',
    integrationModes: [],
    capabilities: [],
    url: 'https://example.test',
    requirements: [],
  };
  assert.throws(
    () =>
      validateCatalogManifest(
        { catalogVersion: 1, updatedAt: '2026-02-30', providers: [provider] },
        'provider',
      ),
    /valid date/,
  );
  assert.throws(
    () =>
      validateCatalogManifest(
        {
          catalogVersion: 1,
          updatedAt: '2026-08-08',
          providers: [{ ...provider, url: 'https://user:pass@example.test' }],
        },
        'provider',
      ),
    /without credentials/,
  );
  assert.throws(
    () =>
      validateCatalogManifest(
        { catalogVersion: 1, updatedAt: '2026-08-08', providers: [provider, provider] },
        'provider',
      ),
    /duplicate provider catalog id/,
  );
});

test('catalog rejects duplicate backend ids', () => {
  assert.throws(
    () =>
      createFrontendCatalog({
        providers: [
          {
            id: 'duplicate-id',
            name: 'One',
            kind: 'cloud-gaming',
            supportLevel: 'A',
            integrationModes: [],
            capabilities: [],
            url: 'https://example.test',
            requirements: [],
          },
        ],
        emulators: [
          {
            id: 'duplicate-id',
            name: 'Two',
            kind: 'native',
            supportLevel: 'A',
            integrationModes: [],
            capabilities: [],
            systems: ['test'],
            mode: 'native',
            url: 'https://example.test',
            license: 'MIT',
          },
        ],
      }),
    /duplicate backend id/,
  );
});
