const POWER_MODES = Object.freeze(['Balanced', 'Performance', 'Battery saver']);

function integer(value, fallback, minimum, maximum) {
  const result = Number(value);
  return Number.isFinite(result)
    ? Math.max(minimum, Math.min(maximum, Math.floor(result)))
    : fallback;
}

/** Normalize optional platform battery evidence without treating missing APIs as a battery state. */
export function normalizePowerState({ mode = 'Balanced', batteryPercent, charging = false } = {}) {
  const selectedMode = POWER_MODES.includes(mode) ? mode : 'Balanced';
  const percent =
    batteryPercent === undefined || batteryPercent === null || batteryPercent === ''
      ? null
      : integer(batteryPercent, null, 0, 100);
  return Object.freeze({
    mode: selectedMode,
    batteryPercent: percent,
    charging: charging === true,
  });
}

/** Resolve a conservative quality ceiling for power-constrained handheld sessions. */
export function resolvePowerQualityPolicy({
  mode = 'Balanced',
  batteryPercent,
  charging = false,
} = {}) {
  const state = normalizePowerState({ mode, batteryPercent, charging });
  const constrained =
    state.mode === 'Battery saver' ||
    (!state.charging && state.batteryPercent !== null && state.batteryPercent <= 20);
  const emergency = !state.charging && state.batteryPercent !== null && state.batteryPercent <= 10;
  const limits = emergency
    ? { maxWidth: 960, maxHeight: 540, maxFramerate: 30, bitrateKbps: 3000 }
    : constrained
      ? { maxWidth: 1280, maxHeight: 720, maxFramerate: 30, bitrateKbps: 6000 }
      : { maxWidth: 3840, maxHeight: 2160, maxFramerate: 240, bitrateKbps: 100000 };
  return Object.freeze({
    state,
    status: emergency ? 'emergency' : constrained ? 'constrained' : 'normal',
    limits: Object.freeze(limits),
    reason: emergency
      ? 'Battery is critically low; quality is capped to preserve session continuity.'
      : constrained
        ? 'Battery-saving policy caps quality to reduce power use.'
        : 'No additional power quality cap is active.',
  });
}

export { POWER_MODES as SESSION_POWER_MODES };
