export const DEFAULT_BINDINGS = Object.freeze({
  confirm: 'button-0', cancel: 'button-1', menu: 'button-9', pause: 'button-8',
  moveUp: 'axis-1-negative', moveDown: 'axis-1-positive', moveLeft: 'axis-0-negative', moveRight: 'axis-0-positive',
});

export const REMOTE_INPUT_KINDS = Object.freeze(['button', 'axis', 'key', 'pointer', 'touch', 'rumble']);
export const REMOTE_INPUT_SOURCES = Object.freeze(['gamepad', 'keyboard', 'pointer', 'touch', 'host']);

function clamp(value, minimum = -1, maximum = 1) { return Math.max(minimum, Math.min(maximum, value)); }
function boundedInteger(value, minimum, maximum, fallback) { const number = Number(value); return Number.isInteger(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback; }

export function applyDeadzone(value, deadzone = 0.12) {
  const amount = Math.abs(value); if (amount <= deadzone) return 0;
  return clamp(Math.sign(value) * ((amount - deadzone) / (1 - deadzone)));
}

export function normalizeGamepadState(gamepad, {deadzone = 0.12} = {}) {
  if (!gamepad || !gamepad.buttons || !gamepad.axes || typeof gamepad.buttons.length !== 'number' || typeof gamepad.axes.length !== 'number') throw new TypeError('A Gamepad-like value is required');
  const buttons = Array.from(gamepad.buttons); const axes = Array.from(gamepad.axes);
  return Object.freeze({
    id: String(gamepad.id || 'unknown'), index: Number.isInteger(gamepad.index) ? gamepad.index : 0,
    connected: gamepad.connected !== false,
    buttons: Object.freeze(buttons.map(button => Object.freeze({pressed: Boolean(button?.pressed), value: clamp(Number(button?.value) || 0, 0, 1)}))),
    axes: Object.freeze(axes.map(axis => applyDeadzone(clamp(Number(axis) || 0), deadzone))),
    timestamp: Number(gamepad.timestamp) || Date.now(),
  });
}

export function createInputMapper({bindings = DEFAULT_BINDINGS, deadzone = 0.12} = {}) {
  const activeBindings = Object.freeze({...DEFAULT_BINDINGS, ...bindings});
  const normalizedAxisDirection = value => value < 0 ? 'negative' : value > 0 ? 'positive' : null;
  return Object.freeze({
    bindings: activeBindings,
    normalize: gamepad => normalizeGamepadState(gamepad, {deadzone}),
    actionFor(control) { return Object.keys(activeBindings).find(action => activeBindings[action] === control); },
    controlsFor(action) { return activeBindings[action] ? [activeBindings[action]] : []; },
    mapButton(index, pressed, value = pressed ? 1 : 0) { const action = this.actionFor(`button-${index}`); return action ? {type: 'input.event', action, pressed: Boolean(pressed), value: clamp(value, 0, 1)} : null; },
    mapAxis(index, value) { const normalized = applyDeadzone(clamp(value), deadzone); const direction = normalized < 0 ? 'negative' : 'positive'; const action = this.actionFor(`axis-${index}-${direction}`); return action && normalized !== 0 ? {type: 'input.event', action, kind: 'axis', pressed: true, value: normalized} : null; },
    mapNativeButton(index, pressed, value = pressed ? 1 : 0) { return Number.isInteger(index) && index >= 0 && index <= 15 ? {type: 'input.event', action: `button-${index}`, kind: 'button', pressed: Boolean(pressed), value: clamp(value, 0, 1)} : null; },
    mapNativeAxis(index, value, previousValue = 0) { if (!Number.isInteger(index) || index < 0 || index > 5) return []; const current = clamp(value); const previous = clamp(previousValue); return Math.abs(current - previous) < 0.0001 ? [] : [{type: 'input.event', action: `axis-${index}`, kind: 'axis', pressed: current !== 0, value: current}]; },
    mapAxisTransition(index, value, previousValue = 0) {
      const current = clamp(value); const previous = clamp(previousValue); const currentDirection = normalizedAxisDirection(current); const previousDirection = normalizedAxisDirection(previous); const events = [];
      if (previousDirection && previousDirection !== currentDirection) {
        const action = this.actionFor(`axis-${index}-${previousDirection}`); if (action) events.push({type: 'input.event', action, kind: 'axis', pressed: false, value: 0});
      }
      if (currentDirection) {
        const action = this.actionFor(`axis-${index}-${currentDirection}`); if (action) events.push({type: 'input.event', action, kind: 'axis', pressed: true, value: current});
      }
      return events;
    },
  });
}

export function createInputEventEnvelope({sessionId, event, sequence = 0, clock = () => new Date().toISOString()} = {}) {
  if (!event || event.type !== 'input.event') throw new TypeError('event must be an input.event');
  if (typeof event.action !== 'string' || !event.action) throw new TypeError('input event action is required');
  const normalized = normalizeRemoteInputEvent(event);
  const payload = {...normalized};
  if (!event.kind) delete payload.kind;
  return createSessionEnvelope({sessionId, type: 'input.event', sequence, sentAt: clock(), payload});
}

export function normalizeRemoteInputEvent(event) {
  if (!event || event.type !== 'input.event') throw new TypeError('event must be an input.event');
  if (typeof event.action !== 'string' || !event.action || event.action.length > 64) throw new TypeError('input event action is required');
  const source = REMOTE_INPUT_SOURCES.includes(event.source) ? event.source : 'gamepad';
  const kind = REMOTE_INPUT_KINDS.includes(event.kind) ? event.kind : source === 'keyboard' ? 'key' : source === 'pointer' ? 'pointer' : source === 'touch' ? 'touch' : 'button';
  const normalized = {
    action: event.action,
    pressed: Boolean(event.pressed),
    value: clamp(Number(event.value) || 0),
    source,
    control: String(event.control || event.action).slice(0, 64),
  };
  if (event.kind || kind !== 'button') normalized.kind = kind;
  if (['pointer', 'touch'].includes(kind)) {
    normalized.x = clamp(Number(event.x) || 0, 0, 1);
    normalized.y = clamp(Number(event.y) || 0, 0, 1);
    normalized.deltaX = clamp(Number(event.deltaX) || 0, -4096, 4096);
    normalized.deltaY = clamp(Number(event.deltaY) || 0, -4096, 4096);
  }
  if (kind === 'rumble') {
    normalized.gamepadIndex = boundedInteger(event.gamepadIndex, 0, 15, 0);
    normalized.durationMs = boundedInteger(event.durationMs, 0, 5000, 0);
    normalized.startDelay = boundedInteger(event.startDelay, 0, 5000, 0);
    normalized.strongMagnitude = clamp(Number(event.strongMagnitude ?? event.value) || 0, 0, 1);
    normalized.weakMagnitude = clamp(Number(event.weakMagnitude ?? event.value) || 0, 0, 1);
  }
  return Object.freeze(normalized);
}
import {createSessionEnvelope} from '../session/session.mjs';
