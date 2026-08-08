import assert from 'node:assert/strict';
import test from 'node:test';
import {createCommunityProviderCatalogStore, mergeCommunityProviders, normalizeCommunityProvider} from './community-catalog.mjs';

function storage() { const values = new Map(); return {getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value)}; }
const bundle = {version: 1, source: {id: 'community-one', name: 'Community One', homepage: 'https://community.example/'}, providers: [{id: 'indie-cloud', name: 'Indie Cloud', kind: 'cloud-gaming', supportLevel: 'A', integrationModes: ['browser-first'], url: 'https://games.example/play', requirements: ['account'], capabilities: ['gamepad', 'fullscreen']}]};

test('community providers normalize as untrusted C/D metadata with HTTPS URLs', () => { const provider = normalizeCommunityProvider(bundle.providers[0], 'community-one'); assert.equal(provider.supportLevel, 'D'); assert.equal(provider.trust, 'community'); assert.throws(() => normalizeCommunityProvider({...bundle.providers[0], url: 'javascript:alert(1)'}, 'community-one'), /HTTPS/); });
test('community catalog stores replace sources, exports, and refuses unsafe bundles', () => { const store = createCommunityProviderCatalogStore({storage: storage()}); assert.equal(store.import(bundle).length, 1); assert.equal(store.sources()[0].id, 'community-one'); assert.equal(JSON.parse(store.export()).sources.length, 1); assert.throws(() => store.import({...bundle, providers: [{...bundle.providers[0], id: 'bad/id'}]}), /invalid characters/); });
test('community providers never override built-in or earlier community IDs', () => { const builtIn = [{id: 'indie-cloud', name: 'Built in'}]; const merged = mergeCommunityProviders({providers: builtIn, community: [{id: 'indie-cloud', name: 'Community'}, {id: 'new-cloud', name: 'New'}, {id: 'new-cloud', name: 'Duplicate'}]}); assert.deepEqual(merged.map(provider => provider.id), ['indie-cloud', 'new-cloud']); });
