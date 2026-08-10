import test from 'node:test';
import assert from 'node:assert/strict';
import {nextConsoleMode, resolveConsoleMode} from './console-mode.mjs';
test('console mode honors explicit settings and device defaults', () => { assert.equal(resolveConsoleMode({settings: {'appearance.consoleMode': true}, deviceMode: 'desktop'}), true); assert.equal(resolveConsoleMode({settings: {'appearance.consoleMode': false}, deviceMode: 'television'}), false); assert.equal(resolveConsoleMode({settings: {}, deviceMode: 'handheld'}), true); assert.equal(resolveConsoleMode({settings: {}, deviceMode: 'desktop'}), false); });
test('console mode toggles reversibly', () => { assert.equal(nextConsoleMode(false), true); assert.equal(nextConsoleMode(true), false); });

