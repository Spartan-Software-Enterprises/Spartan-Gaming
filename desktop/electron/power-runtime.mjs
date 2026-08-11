const POWER_MODES = new Set(['Balanced', 'Performance', 'Battery saver']);
const THERMAL_STATES = new Set(['unknown', 'nominal', 'fair', 'serious', 'critical']);

export function normalizePowerRuntimeState({
  active = false,
  powerMode = 'Balanced',
  onBattery = false,
  thermalState = 'unknown',
  speedLimit = 100,
} = {}) {
  const mode = POWER_MODES.has(powerMode) ? powerMode : 'Balanced';
  const thermal = THERMAL_STATES.has(thermalState) ? thermalState : 'unknown';
  const limit = Number(speedLimit);
  return Object.freeze({
    active: active === true,
    powerMode: mode,
    onBattery: onBattery === true,
    thermalState: thermal,
    speedLimit: Number.isFinite(limit) ? Math.max(0, Math.min(100, Math.round(limit))) : 100,
  });
}

export function resolvePowerSaveBlockerType({ active = false, powerMode = 'Balanced' } = {}) {
  if (active !== true || !POWER_MODES.has(powerMode)) return null;
  return powerMode === 'Battery saver' ? 'prevent-app-suspension' : 'prevent-display-sleep';
}

export function resolveApplicationSessionActive({
  gameSession = false,
  providerSession = false,
} = {}) {
  return gameSession === true || providerSession === true;
}

export function normalizePowerEvent(type, details = {}) {
  const name = typeof type === 'string' && type.trim() ? type.trim() : 'unknown';
  const payload = { type: name };
  if (['on-battery', 'on-ac'].includes(name)) payload.onBattery = name === 'on-battery';
  if (name === 'thermal-state-change')
    payload.thermalState = THERMAL_STATES.has(details.state) ? details.state : 'unknown';
  if (name === 'speed-limit-change') {
    const limit = Number(details.limit);
    payload.speedLimit = Number.isFinite(limit)
      ? Math.max(0, Math.min(100, Math.round(limit)))
      : 100;
  }
  return Object.freeze(payload);
}

export const ELECTRON_POWER_MODES = Object.freeze([...POWER_MODES]);
