import test from 'node:test';
import assert from 'node:assert/strict';
import {BUILTIN_CONTROLLER_PROFILES, createControllerProfile, createControllerProfileStore, updateControllerBinding, validateBindings} from './profiles.mjs';

test('built-in profiles cover common controller families and are immutable', () => { assert.equal(BUILTIN_CONTROLLER_PROFILES.length, 13); assert.ok(BUILTIN_CONTROLLER_PROFILES.some(profile => profile.id === 'racing-wheel-layout')); assert.ok(BUILTIN_CONTROLLER_PROFILES.some(profile => profile.id === 'flight-stick-layout')); assert.equal(Object.isFrozen(BUILTIN_CONTROLLER_PROFILES[0]), true); });
test('binding validation rejects collisions', () => { assert.throws(() => validateBindings({confirm: 'button-0', cancel: 'button-0'}), /already bound/); });
test('profile updates preserve metadata and reject accidental collisions', () => { const profile = createControllerProfile({id: 'test-pad', name: 'Test pad'}); const updated = updateControllerBinding(profile, 'confirm', 'button-4'); assert.equal(updated.bindings.confirm, 'button-4'); assert.throws(() => updateControllerBinding(updated, 'cancel', 'button-4'), /already bound/); });
test('profile store persists, replaces, and removes profiles', () => { const store = createControllerProfileStore(); store.save({id: 'pad', name: 'Pad'}); store.save({id: 'pad', name: 'Updated pad'}); assert.equal(store.list().length, 1); assert.equal(store.get('pad').name, 'Updated pad'); store.remove('pad'); assert.equal(store.get('pad'), undefined); });
