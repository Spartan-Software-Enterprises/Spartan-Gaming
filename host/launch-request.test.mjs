import assert from 'node:assert/strict';
import test from 'node:test';
import {matchesHostLaunchRequest, normalizeHostLaunchRequest} from './launch-request.mjs';

const request = {version: 1, kind: 'emulator', coreId: 'dolphin', runtime: {id: 'dolphin-linux', kind: 'native-emulator', version: '5.0'}, hostContentId: 'entry-1', content: {game: {name: 'game.iso', size: 10}, firmware: []}, consent: {approved: true, at: '2026-08-08T00:00:00.000Z'}};

test('host launch request normalization retains only safe metadata and matches configured content', () => { const normalized = normalizeHostLaunchRequest(request); assert.equal(normalized.runtime.id, 'dolphin-linux'); assert.equal(matchesHostLaunchRequest(normalized, {runtimeId: 'dolphin-linux', hostContentId: 'entry-1', gameName: 'game.iso'}), true); assert.equal(matchesHostLaunchRequest(normalized, {runtimeId: 'other', hostContentId: 'entry-1', gameName: 'game.iso'}), false); });
test('host launch request rejects paths, missing consent, and malformed content', () => { assert.throws(() => normalizeHostLaunchRequest({...request, consent: {approved: false, at: request.consent.at}}), /consent/); assert.throws(() => normalizeHostLaunchRequest({...request, content: {...request.content, game: {...request.content.game, path: '/tmp/game.iso'}}}), /metadata only/); assert.throws(() => normalizeHostLaunchRequest({...request, content: {...request.content, game: {name: 'game.iso', size: -1}}}), /size/); });
