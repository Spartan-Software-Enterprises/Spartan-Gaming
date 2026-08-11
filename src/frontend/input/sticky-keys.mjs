const MODIFIER_CODES = Object.freeze(
  new Set([
    'AltLeft',
    'AltRight',
    'ControlLeft',
    'ControlRight',
    'MetaLeft',
    'MetaRight',
    'ShiftLeft',
    'ShiftRight',
  ]),
);

/** Turn one-shot modifier presses into bounded modifier chords for keyboard-only sessions. */
export function createStickyKeysController({ enabled = false } = {}) {
  const latched = new Set();
  return Object.freeze({
    process(code, pressed) {
      if (typeof code !== 'string' || typeof pressed !== 'boolean') return [];
      if (!enabled) return [{ code, pressed }];
      if (!MODIFIER_CODES.has(code)) {
        if (pressed) return [{ code, pressed: true }];
        const events = [{ code, pressed: false }];
        for (const modifier of latched) events.push({ code: modifier, pressed: false });
        latched.clear();
        return events;
      }
      if (!pressed) return [];
      if (latched.has(code)) {
        latched.delete(code);
        return [{ code, pressed: false }];
      }
      latched.add(code);
      return [{ code, pressed: true }];
    },
    flush() {
      const events = [...latched].map((code) => ({ code, pressed: false }));
      latched.clear();
      return events;
    },
  });
}
