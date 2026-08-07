import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceStore, DEFAULT_WORKSPACES} from './workspaces.mjs';

function storage() { const values = new Map(); return {getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value)}; }

test('workspace store provides isolated defaults and persists active selection', () => { const store = createWorkspaceStore({storage: storage()}); assert.equal(store.list().length, DEFAULT_WORKSPACES.length); const created = store.create({name: 'Arcade Night', quality: 'high'}); assert.equal(store.active.id, created.id); assert.equal(store.active.quality, 'high'); });
test('workspace store updates, removes, and imports portable profiles', () => { const store = createWorkspaceStore({storage: storage()}); const created = store.create({name: 'Travel'}); store.update(created.id, {launchBehavior: 'new-window', overlay: false}); assert.equal(store.active.launchBehavior, 'new-window'); const exported = store.export(); const other = createWorkspaceStore({storage: storage(), initial: [DEFAULT_WORKSPACES[0]]}); other.import(exported); assert.equal(other.list().some(item => item.id === created.id), true); other.remove(created.id); assert.equal(other.list().some(item => item.id === created.id), false); });
test('workspace store rejects invalid destructive operations', () => { const store = createWorkspaceStore({storage: storage(), initial: [DEFAULT_WORKSPACES[0]]}); assert.throws(() => store.remove('gaming'), /At least one/); assert.throws(() => store.setActive('missing'), /Unknown/); });
