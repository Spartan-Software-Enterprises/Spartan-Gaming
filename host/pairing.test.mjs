import test from 'node:test';
import assert from 'node:assert/strict';
import {createPairingAuthority, createPairingCode, normalizePairingCode} from './pairing.mjs';

test('pairing codes use the unambiguous alphabet and normalize separators', () => { const code = createPairingCode(); assert.match(code, /^[A-HJ-NP-Z2-9]{8}$/); assert.equal(normalizePairingCode(`${code.slice(0, 4)}-${code.slice(4)}`), code); });
test('pairing authority expires and is single-use', () => { const authority = createPairingAuthority({code: 'ABCD23', expiresAt: Date.now() + 60_000}); assert.equal(authority.verify('abcd-23'), true); assert.equal(authority.verify('ABCD23'), false); });
test('pairing matches can be checked before consuming a valid retry', () => { const authority = createPairingAuthority({code: 'ABCD23', expiresAt: Date.now() + 60_000}); assert.equal(authority.matches('ABCD23'), true); assert.equal(authority.used, false); assert.equal(authority.verify('ABCD23'), true); assert.equal(authority.used, true); });
test('expired pairing authority fails closed', () => { const authority = createPairingAuthority({code: 'ABCD23', expiresAt: Date.now() - 1}); assert.equal(authority.expired, true); assert.equal(authority.verify('ABCD23'), false); });
