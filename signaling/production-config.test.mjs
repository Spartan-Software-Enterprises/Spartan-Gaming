import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeProductionConfig} from './production-config.mjs';

const valid = {secret: 's'.repeat(32), adminSecret: 'a'.repeat(32), tlsKey: '/run/secrets/key', tlsCert: '/run/secrets/cert', allowedOrigins: ['https://play.example'], sessionStore: 'redis', turnUrls: ['turns:turn.example:5349']};

test('production signaling config normalizes safe operator prerequisites without exposing secrets', () => { const config = normalizeProductionConfig(valid); assert.deepEqual(config.allowedOrigins, ['https://play.example']); assert.equal(config.sessionStore, 'redis'); assert.deepEqual(config.secrets, {configured: true, adminConfigured: true}); assert.equal('secret' in config, false); });
test('production signaling config rejects weak, insecure, or reference-only deployment settings', () => { assert.throws(() => normalizeProductionConfig({...valid, secret: 'short'}), /at least 32/); assert.throws(() => normalizeProductionConfig({...valid, tlsCert: ''}), /TLS certificate/); assert.throws(() => normalizeProductionConfig({...valid, allowedOrigins: ['http://play.example']}), /HTTPS/); assert.throws(() => normalizeProductionConfig({...valid, sessionStore: 'memory'}), /session store/); assert.throws(() => normalizeProductionConfig({...valid, turnUrls: ['stun:stun.example']}), /TURN/); });
