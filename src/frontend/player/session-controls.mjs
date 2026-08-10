const PAUSABLE_STATES = new Set(['connected', 'reconnecting']);

export function resolveSessionPauseAction({status = 'idle', paused = false} = {}) {
  if (!PAUSABLE_STATES.has(status)) return Object.freeze({available: false, paused: Boolean(paused), action: null, label: 'Pause session', message: 'Pause is available after the session connects.'});
  const nextPaused = !paused;
  return Object.freeze({available: true, paused: nextPaused, action: nextPaused ? 'pause' : 'resume', label: nextPaused ? 'Resume session' : 'Pause session', glyph: nextPaused ? '▶' : 'Ⅱ', message: nextPaused ? 'Session paused.' : 'Session resumed.'});
}
