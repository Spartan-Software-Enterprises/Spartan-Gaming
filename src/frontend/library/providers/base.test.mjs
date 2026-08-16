import test from 'node:test';
import assert from 'node:assert/strict';
import { MetadataProvider, PROVIDER_PRIORITY } from './base.mjs';
import { IGDBProvider } from './implementations.mjs';

test('PROVIDER_PRIORITY has correct priority values', () => {
  assert.strictEqual(PROVIDER_PRIORITY.igdb, 10);
  assert.strictEqual(PROVIDER_PRIORITY.hasheous, 9);
  assert.strictEqual(PROVIDER_PRIORITY.rawg, 8);
  assert.strictEqual(PROVIDER_PRIORITY.playmatch, 7);
  assert.strictEqual(PROVIDER_PRIORITY.steamgriddb, 5);
});

test('MetadataProvider base class has required properties', () => {
  const provider = new MetadataProvider({
    name: 'test',
    baseUrl: 'https://api.example.com',
  });
  assert.strictEqual(provider.name, 'test');
  assert.strictEqual(provider.baseUrl, 'https://api.example.com');
});
