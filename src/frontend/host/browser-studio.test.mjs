import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeBrowserHostConfig} from './browser-studio.mjs';

test('browser host studio normalizes connection fields without persistence', () => { assert.deepEqual(normalizeBrowserHostConfig({endpoint: ' wss://relay.example/signal ', sessionId: ' ses-1 ', ticket: ' ticket ', hostId: '', hostName: ''}), {endpoint: 'wss://relay.example/signal', sessionId: 'ses-1', ticket: 'ticket', hostId: 'browser-host', hostName: 'Browser Host'}); });
