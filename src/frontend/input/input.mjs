export const DEFAULT_BINDINGS = Object.freeze({
  confirm: 'button-0', cancel: 'button-1', menu: 'button-9', pause: 'button-8',
  moveUp: 'axis-1-negative', moveDown: 'axis-1-positive', moveLeft: 'axis-0-negative', moveRight: 'axis-0-positive',
});

function clamp(value, minimum = -1, maximum = 1) { return Math.max(minimum, Math.min(maximum, value)); }

export function applyDeadzone(value, deadzone = 0.12) {
  const amount = Math.abs(value); if (amount <= deadzone) return 0;
  return clamp(Math.sign(value) * ((amount - deadzone) / (1 - deadzone)));
}

export function normalizeGamepadState(gamepad, {deadzone = 0.12} = {}) {
  if (!gamepad || !Array.isArray(gamepad.buttons) || !Array.isArray(gamepad.axes)) throw new TypeError('A Gamepad-like value is required');
  return Object.freeze({
    id: String(gamepad.id || 'unknown'), index: Number.isInteger(gamepad.index) ? gamepad.index : 0,
    connected: gamepad.connected !== false,
    buttons: Object.freeze(gamepad.buttons.map(button => Object.freeze({pressed: Boolean(button?.pressed), value: clamp(Number(button?.value) || 0, 0, 1)}))),
    axes: Object.freeze(gamepad.axes.map(axis => applyDeadzone(clamp(Number(axis) || 0), deadzone))),
    timestamp: Number(gamepad.timestamp) || Date.now(),
  });
}

export function createInputMapper({bindings = DEFAULT_BINDINGS, deadzone = 0.12} = {}) {
  const activeBindings = Object.freeze({...DEFAULT_BINDINGS, ...bindings});
  return Object.freeze({
    bindings: activeBindings,
    normalize: gamepad => normalizeGamepadState(gamepad, {deadzone}),
    actionFor(control) { return Object.keys(activeBindings).find(action => activeBindings[action] === control); },
    controlsFor(action) { return activeBindings[action] ? [activeBindings[action]] : []; },
    mapButton(index, pressed, value = pressed ? 1 : 0) { const action = this.actionFor(`button-${index}`); return action ? {type: 'input.event', action, pressed: Boolean(pressed), value: clamp(value, 0, 1)} : null; },
    mapAxis(index, value) { const normalized = applyDeadzone(clamp(value), deadzone); const direction = normalized < 0 ? 'negative' : 'positive'; const action = this.actionFor(`axis-${index}-${direction}`); return action && normalized !== 0 ? {type: 'input.event', action, pressed: true, value: normalized} : null; },
  });
}

export function createInputEventEnvelope({sessionId, event, sequence = 0, clock = () => new Date().toISOString()} = {}) {
  if (!event || event.type !== 'input.event') throw new TypeError('event must be an input.event');
  if (typeof event.action !== 'string' || !event.action) throw new TypeError('input event action is required');
  return createSessionEnvelope({sessionId, type: 'input.event', sequence, sentAt: clock(), payload: {action: event.action, pressed: Boolean(event.pressed), value: clamp(Number(event.value) || 0), source: event.source || 'gamepad', control: event.control || event.action}});
}
import {createSessionEnvelope} from '../session/session.mjs';
