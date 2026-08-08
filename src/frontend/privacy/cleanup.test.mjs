import test from 'node:test';
import assert from 'node:assert/strict';
import {TRANSIENT_SESSION_KEYS, clearTransientSessionData} from './cleanup.mjs';

test('clear-on-exit cleanup removes only Spartan transient session handoffs', () => { const removed = []; const storage = {removeItem: key => removed.push(key)}; assert.deepEqual(clearTransientSessionData(storage), [...TRANSIENT_SESSION_KEYS]); assert.deepEqual(removed, [...TRANSIENT_SESSION_KEYS]); });
test('clear-on-exit cleanup degrades safely without session storage', () => { assert.deepEqual(clearTransientSessionData(null), []); assert.deepEqual(clearTransientSessionData({removeItem() {}}, ['valid', '', null]), ['valid']); });
