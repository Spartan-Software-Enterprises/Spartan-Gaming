import test from 'node:test';
import assert from 'node:assert/strict';
import {createFavoritesStore} from './library-state.mjs';

function storage() { const values = new Map(); return {getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key)}; }
test('favorites are isolated by workspace and persist safely', () => { const backend = storage(); const gaming = createFavoritesStore({storage: backend, workspaceId: 'gaming'}); const family = createFavoritesStore({storage: backend, workspaceId: 'family'}); gaming.toggle('xbox-cloud'); assert.deepEqual(gaming.list(), ['xbox-cloud']); assert.deepEqual(family.list(), []); assert.equal(gaming.has('xbox-cloud'), true); });
test('favorites reject malformed ids and bound stored collections', () => { const backend = storage(); const store = createFavoritesStore({storage: backend, workspaceId: 'guest'}); assert.throws(() => createFavoritesStore({storage: backend, workspaceId: 'bad space'}), /safe profile/); store.set(['valid-id', 'not valid', 'valid-id']); assert.deepEqual(store.list(), ['valid-id']); });
test('default workspace migrates the previous unscoped favorites collection', () => { const backend = storage(); backend.setItem('spartan-gaming.favorites.v1', JSON.stringify(['steam', 'xbox-cloud'])); const store = createFavoritesStore({storage: backend, workspaceId: 'gaming'}); assert.deepEqual(store.list(), ['steam', 'xbox-cloud']); });
