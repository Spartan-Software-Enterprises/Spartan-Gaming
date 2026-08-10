function clamp(value, minimum, maximum, fallback = minimum) { const number = Number(value); return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback; }

export function normalizeHapticRequest(request = {}) {
  return Object.freeze({gamepadIndex: Math.max(0, Math.min(15, Math.floor(clamp(request.gamepadIndex, 0, 15, 0)))), durationMs: Math.floor(clamp(request.durationMs, 0, 5000, 0)), startDelay: Math.floor(clamp(request.startDelay, 0, 5000, 0)), strongMagnitude: clamp(request.strongMagnitude ?? request.value, 0, 1, 0), weakMagnitude: clamp(request.weakMagnitude ?? request.value, 0, 1, 0)});
}

export function createHapticsController({navigatorRef = globalThis.navigator, enabled = true} = {}) {
  return Object.freeze({
    get supported() { return Boolean(navigatorRef?.getGamepads); },
    async play(request = {}) {
      if (!enabled || typeof navigatorRef?.getGamepads !== 'function') return false;
      const haptic = [...(navigatorRef.getGamepads() || [])].find(gamepad => gamepad?.index === normalizeHapticRequest(request).gamepadIndex) || [...(navigatorRef.getGamepads() || [])].find(Boolean);
      const actuator = haptic?.vibrationActuator || haptic?.hapticActuators?.[0];
      if (!actuator || typeof actuator.playEffect !== 'function') return false;
      const normalized = normalizeHapticRequest(request);
      try { await actuator.playEffect('dual-rumble', {duration: normalized.durationMs, startDelay: normalized.startDelay, strongMagnitude: normalized.strongMagnitude, weakMagnitude: normalized.weakMagnitude}); return true; } catch { return false; }
    },
  });
}
