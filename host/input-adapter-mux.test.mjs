import assert from 'node:assert/strict';
import test from 'node:test';
import {createInputAdapterMux} from './input-adapter-mux.mjs';

test('input adapter mux sends gamepad operations to the optional driver', async () => { const calls = []; const mux = createInputAdapterMux({platform: 'win32', base: {execute: async operation => calls.push(['base', operation.kind])}, virtualGamepad: {platform: 'win32', execute: async operation => calls.push(['virtual', operation.kind])}}); await mux.execute({kind: 'button'}); await mux.execute({kind: 'key'}); assert.deepEqual(calls, [['virtual', 'button'], ['base', 'key']]); });
