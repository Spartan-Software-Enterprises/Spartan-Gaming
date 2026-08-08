import assert from 'node:assert/strict';
import test from 'node:test';
import {resolveSessionPauseAction} from './session-controls.mjs';

test('session pause control is unavailable before a session connects', () => {
  assert.deepEqual(resolveSessionPauseAction({status: 'negotiating'}), {available: false, paused: false, action: null, label: 'Pause session', message: 'Pause is available after the session connects.'});
});

test('session pause control alternates validated pause and resume actions', () => {
  const paused = resolveSessionPauseAction({status: 'connected', paused: false});
  assert.equal(paused.action, 'pause');
  assert.equal(paused.glyph, '▶');
  const resumed = resolveSessionPauseAction({status: 'connected', paused: true});
  assert.equal(resumed.action, 'resume');
  assert.equal(resumed.glyph, 'Ⅱ');
});
