import { createInputMapper, normalizeGamepadState } from '../input/input.mjs';

const DEFAULT_KEYS = Object.freeze({
  Enter: 'confirm',
  Escape: 'cancel',
  Tab: 'menu',
  KeyP: 'pause',
  ArrowUp: 'moveUp',
  ArrowDown: 'moveDown',
  ArrowLeft: 'moveLeft',
  ArrowRight: 'moveRight',
});

function emit(runtime, event) {
  if (['running', 'paused'].includes(runtime.state))
    return Promise.resolve(runtime.input(Object.freeze({ type: 'input.event', ...event }))).catch(
      () => {},
    );
  return Promise.resolve();
}

export function createBrowserEmulatorInputBridge({
  runtime,
  target = globalThis,
  canvas = null,
  mapper = createInputMapper(),
  keyboardBindings = DEFAULT_KEYS,
  pollIntervalMs = 50,
} = {}) {
  if (!runtime || typeof runtime.input !== 'function')
    throw new TypeError('runtime with input() is required');
  if (
    !target ||
    typeof target.addEventListener !== 'function' ||
    typeof target.removeEventListener !== 'function'
  )
    throw new TypeError('input target must support event listeners');
  if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 16 || pollIntervalMs > 1000)
    throw new RangeError('pollIntervalMs must be between 16 and 1000');
  const pressed = new Set();
  const previous = new Map();
  let timer = null;
  let active = false;
  const keyboardFocused = () =>
    ['running', 'paused'].includes(runtime.state) &&
    (!canvas || target.document?.activeElement === canvas);
  const keydown = (event) => {
    const action = keyboardBindings[event.code];
    if (!action || pressed.has(event.code) || !keyboardFocused()) return;
    pressed.add(event.code);
    event.preventDefault?.();
    emit(runtime, {
      action,
      pressed: true,
      value: 1,
      source: 'keyboard',
      kind: 'key',
      control: `key-${event.code}`,
    });
  };
  const keyup = (event) => {
    const action = keyboardBindings[event.code];
    if (!action) return;
    pressed.delete(event.code);
    event.preventDefault?.();
    emit(runtime, {
      action,
      pressed: false,
      value: 0,
      source: 'keyboard',
      kind: 'key',
      control: `key-${event.code}`,
    });
  };
  const focus = () => canvas?.focus?.();
  function pollGamepads() {
    const pads = target.navigator?.getGamepads?.() || [];
    for (const pad of pads) {
      if (!pad) continue;
      const normalized = normalizeGamepadState(pad, { deadzone: mapper.deadzone ?? 0.12 });
      normalized.buttons.forEach((button, index) => {
        const key = `${normalized.index}:button-${index}`;
        const prior = previous.get(key) || { pressed: false, value: 0 };
        if (prior.pressed !== button.pressed || (button.pressed && prior.value !== button.value)) {
          previous.set(key, { pressed: button.pressed, value: button.value });
          const mapped = mapper.actionFor(`button-${index}`);
          if (mapped)
            emit(runtime, {
              action: mapped,
              pressed: button.pressed,
              value: button.value,
              source: 'gamepad',
              kind: 'button',
              control: `button-${index}`,
            });
        }
      });
      normalized.axes.forEach((value, index) => {
        const key = `${normalized.index}:axis-${index}`;
        const prior = previous.get(key) || 0;
        if (Math.abs(value - prior) < 0.01) return;
        previous.set(key, value);
        const direction =
          value === 0 && prior !== 0
            ? prior < 0
              ? 'negative'
              : 'positive'
            : value < 0
              ? 'negative'
              : 'positive';
        const mapped = mapper.actionFor(`axis-${index}-${direction}`);
        if (mapped)
          emit(runtime, {
            action: mapped,
            pressed: value !== 0,
            value,
            source: 'gamepad',
            kind: 'axis',
            control: `axis-${index}-${direction}`,
          });
      });
    }
  }
  function start() {
    if (active) return bridge;
    active = true;
    target.addEventListener('keydown', keydown);
    target.addEventListener('keyup', keyup);
    canvas?.addEventListener?.('pointerdown', focus);
    pollGamepads();
    timer = target.setInterval?.(pollGamepads, pollIntervalMs) ?? null;
    return bridge;
  }
  function close() {
    if (!active) return;
    active = false;
    target.removeEventListener('keydown', keydown);
    target.removeEventListener('keyup', keyup);
    canvas?.removeEventListener?.('pointerdown', focus);
    if (timer !== null) target.clearInterval?.(timer);
    timer = null;
    pressed.clear();
    previous.clear();
  }
  const bridge = Object.freeze({
    get active() {
      return active;
    },
    poll: pollGamepads,
    start,
    close,
  });
  return bridge;
}

export const browserEmulatorKeyboardBindings = DEFAULT_KEYS;
