import { normalizeGamepadState } from './input.mjs';
import { controllerPolicyFromSettings } from './controller-policy.mjs';

export function inspectGamepad(gamepad, { deadzone = 0.12 } = {}) {
  const state = normalizeGamepadState(gamepad, { deadzone });
  return Object.freeze({
    ...state,
    haptics: Array.isArray(gamepad.vibrationActuators) && gamepad.vibrationActuators.length > 0,
    hand: gamepad.hand || 'unknown',
    mapping: gamepad.mapping || 'unknown',
    batteryLevel: Number.isFinite(gamepad.batteryLevel)
      ? Math.max(0, Math.min(1, gamepad.batteryLevel))
      : null,
  });
}

export function detectInputCapabilities({ navigatorRef = globalThis.navigator } = {}) {
  return Object.freeze({
    gamepad: typeof navigatorRef?.getGamepads === 'function',
    hid: Boolean(navigatorRef?.hid?.getDevices),
    vibration: typeof navigatorRef?.vibrate === 'function',
  });
}

export function resolveControllerPreferences(settings = {}) {
  const { version, inputLatency, deadzone, ...policy } = controllerPolicyFromSettings(settings);
  return Object.freeze({
    ...policy,
    deadzone: deadzone / 100,
    inputPolling: inputLatency,
  });
}

/** Apply the configured gamepad permission and local player-slot policy to a browser inventory. */
export function selectInspectableGamepads(gamepads = [], preferences = {}) {
  if (preferences.allowGamepad === false) return Object.freeze([]);
  const available = [...gamepads].filter(Boolean);
  const configuredSlots = Number.isInteger(preferences.playerSlots) ? preferences.playerSlots : 4;
  const limit = preferences.multipleControllers === false ? 1 : Math.max(1, configuredSlots);
  return Object.freeze(available.slice(0, limit));
}

/** Read the browser inventory only when the active controller policy permits gamepad access. */
export function readInspectableGamepads({
  navigatorRef = globalThis.navigator,
  preferences = {},
} = {}) {
  if (preferences.allowGamepad === false) return Object.freeze([]);
  return selectInspectableGamepads(navigatorRef?.getGamepads?.() || [], preferences);
}

export async function listApprovedHidDevices({ navigatorRef = globalThis.navigator } = {}) {
  if (typeof navigatorRef?.hid?.getDevices !== 'function') return [];
  const devices = await navigatorRef.hid.getDevices();
  return devices.map((device) =>
    Object.freeze({
      productName: String(device.productName || 'HID device'),
      vendorId: Number(device.vendorId) || 0,
      productId: Number(device.productId) || 0,
      opened: Boolean(device.opened),
    }),
  );
}
