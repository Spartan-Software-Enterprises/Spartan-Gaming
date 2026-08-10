import assert from 'node:assert/strict';
import test from 'node:test';
import {formatSessionVolume, normalizeSessionVolume, setSessionVolume} from './volume.mjs';

test('session volume is bounded and formatted for the live player control', () => { assert.equal(normalizeSessionVolume(-1), 0); assert.equal(normalizeSessionVolume(2), 1); assert.equal(normalizeSessionVolume('invalid', 0.35), 0.35); assert.equal(formatSessionVolume(0.356), '36%'); });
test('session volume applies only to the active media element', () => { const video = {volume: 1}; assert.equal(setSessionVolume(video, 0.42), 0.42); assert.equal(video.volume, 0.42); assert.throws(() => setSessionVolume(null, 0.5), /video target/); });
