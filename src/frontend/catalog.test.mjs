import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {createFrontendCatalog, validateCatalogManifest} from './catalog.mjs';

async function load(path) {
  return JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8'));
}

test('provider and emulator manifests compose into one frontend catalog', async () => {
  const providers = await load('providers/catalog.json');
  const emulators = await load('emulators/catalog.json');
  const providerEntries = validateCatalogManifest(providers, 'provider');
  const emulatorEntries = validateCatalogManifest(emulators, 'emulator');
  const catalog = createFrontendCatalog({providers: providerEntries, emulators: emulatorEntries});

  assert.equal(catalog.entries.length, providerEntries.length + emulatorEntries.length);
  assert.equal(catalog.get('xbox-cloud-gaming').backendType, 'provider');
  assert.ok(providerEntries.length >= 20);
  for (const id of ['playstation-plus-cloud', 'blacknut', 'antstream', 'parsec', 'xbox-remote-play', 'sunshine-moonlight', 'spartan-host']) assert.equal(catalog.get(id).backendType, 'provider');
  assert.equal(catalog.get('pcsx2').backendType, 'emulator');
  assert.ok(catalog.find({backendType: 'provider', capability: 'gamepad'}).length > 0);
  assert.ok(catalog.find({backendType: 'emulator', supportLevel: 'B'}).length > 0);
  assert.ok(catalog.find({backendType: 'emulator'}).some((entry) => entry.id === 'pcsx2' && entry.systems.includes('playstation-2')));
});

test('catalog rejects duplicate backend ids', () => {
  assert.throws(
    () => createFrontendCatalog({
      providers: [{
        id: 'duplicate-id', name: 'One', kind: 'cloud-gaming', supportLevel: 'A',
        integrationModes: [], capabilities: [], url: 'https://example.test', requirements: [],
      }],
      emulators: [{
        id: 'duplicate-id', name: 'Two', kind: 'native', supportLevel: 'A',
        integrationModes: [], capabilities: [], systems: ['test'], mode: 'native',
        url: 'https://example.test', license: 'MIT',
      }],
    }),
    /duplicate backend id/,
  );
});
