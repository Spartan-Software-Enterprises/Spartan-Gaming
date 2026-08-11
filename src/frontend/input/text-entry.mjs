const MAX_TEXT_LENGTH = 4096;
const ACTIONS = Object.freeze(['show', 'hide', 'update']);

function index(value, length, fallback) {
  const number = Number(value);
  return Number.isInteger(number) ? Math.max(0, Math.min(length, number)) : fallback;
}

/** Normalize IME text without allowing native objects or unbounded payloads across the session boundary. */
export function normalizeTextEntryState({
  text = '',
  selectionStart = 0,
  selectionEnd = selectionStart,
  composingStart = -1,
  composingEnd = -1,
} = {}) {
  if (typeof text !== 'string' || text.length > MAX_TEXT_LENGTH || text.includes('\u0000'))
    throw new TypeError('text entry text is invalid or too large');
  const start = index(selectionStart, text.length, 0);
  const end = index(selectionEnd, text.length, start);
  const hasComposition = composingStart !== -1 || composingEnd !== -1;
  const compositionStart = hasComposition ? index(composingStart, text.length, -1) : -1;
  const compositionEnd = hasComposition ? index(composingEnd, text.length, compositionStart) : -1;
  if (hasComposition && (compositionStart < 0 || compositionEnd < compositionStart))
    throw new TypeError('text entry composition range is invalid');
  return Object.freeze({
    text,
    selectionStart: Math.min(start, end),
    selectionEnd: Math.max(start, end),
    composingStart: compositionStart,
    composingEnd: compositionEnd,
  });
}

/** Create a platform-neutral request; showing an IME always requires a fresh user gesture. */
export function normalizeTextEntryRequest({
  action = 'update',
  userInitiated = false,
  hasFocus = false,
  state,
} = {}) {
  if (!ACTIONS.includes(action)) throw new TypeError('text entry action is unsupported');
  const normalizedState = action === 'hide' ? null : normalizeTextEntryState(state);
  const allowed = action !== 'show' || (userInitiated === true && hasFocus === true);
  return Object.freeze({
    version: 1,
    kind: 'text-entry.request',
    action,
    allowed,
    userInitiated: userInitiated === true,
    hasFocus: hasFocus === true,
    ime: 'android-game-text-input',
    state: normalizedState,
  });
}

export const TEXT_ENTRY_MAX_LENGTH = MAX_TEXT_LENGTH;
