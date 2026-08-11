import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeTextEntryRequest,
  normalizeTextEntryState,
  TEXT_ENTRY_MAX_LENGTH,
} from './text-entry.mjs';

test('text entry preserves bounded selection and composing ranges', () => {
  assert.deepEqual(
    normalizeTextEntryState({
      text: 'hel',
      selectionStart: 3,
      selectionEnd: 1,
      composingStart: 0,
      composingEnd: 2,
    }),
    { text: 'hel', selectionStart: 1, selectionEnd: 3, composingStart: 0, composingEnd: 2 },
  );
});

test('text entry clamps indexes and rejects native-unsafe payloads', () => {
  assert.equal(normalizeTextEntryState({ text: 'abc', selectionStart: 99 }).selectionStart, 3);
  assert.equal(normalizeTextEntryState({ text: 'abc', selectionStart: 99 }).selectionEnd, 3);
  assert.throws(() => normalizeTextEntryState({ text: '\u0000' }), /invalid/);
  assert.throws(
    () => normalizeTextEntryState({ text: 'x'.repeat(TEXT_ENTRY_MAX_LENGTH + 1) }),
    /too large/,
  );
  assert.throws(
    () => normalizeTextEntryState({ text: 'abc', composingStart: 2, composingEnd: 1 }),
    /composition/,
  );
});

test('showing the IME is fail-closed until a focused user gesture exists', () => {
  assert.equal(normalizeTextEntryRequest({ action: 'show', hasFocus: true }).allowed, false);
  const request = normalizeTextEntryRequest({
    action: 'show',
    userInitiated: true,
    hasFocus: true,
    state: { text: 'hi', selectionStart: 2 },
  });
  assert.equal(request.allowed, true);
  assert.equal(request.ime, 'android-game-text-input');
  assert.equal(normalizeTextEntryRequest({ action: 'hide' }).state, null);
});
