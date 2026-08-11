import { normalizeGamepadState } from './input.mjs';

const FOCUSABLE_SELECTOR =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const runtimeNavigators = new WeakMap();

export function focusFirstControl(elements = []) {
  const first = [...elements].find((element) => typeof element?.focus === 'function');
  first?.focus();
  return first || null;
}

export function chooseFocusIndex(elements, currentIndex, direction, { wrap = false } = {}) {
  if (!elements.length) return -1;
  const current = elements[Math.max(0, Math.min(currentIndex, elements.length - 1))];
  const currentRect = current?.getBoundingClientRect?.() || {
    left: currentIndex,
    top: 0,
    width: 1,
    height: 1,
  };
  const origin = {
    x: currentRect.left + currentRect.width / 2,
    y: currentRect.top + currentRect.height / 2,
  };
  const candidates = elements
    .map((element, index) => {
      const rect = element.getBoundingClientRect?.() || {
        left: index,
        top: 0,
        width: 1,
        height: 1,
      };
      const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      const dx = center.x - origin.x;
      const dy = center.y - origin.y;
      const forward =
        direction === 'left'
          ? dx < -1
          : direction === 'right'
            ? dx > 1
            : direction === 'up'
              ? dy < -1
              : dy > 1;
      return {
        index,
        forward,
        primary: direction === 'left' || direction === 'right' ? Math.abs(dx) : Math.abs(dy),
        secondary: direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx),
      };
    })
    .filter((item) => item.index !== currentIndex && item.forward)
    .sort((a, b) => a.primary + a.secondary * 1.5 - (b.primary + b.secondary * 1.5));
  if (candidates[0]) return candidates[0].index;
  if (!wrap) return currentIndex;
  const axis = direction === 'left' || direction === 'right' ? 'x' : 'y';
  const sign = direction === 'left' || direction === 'up' ? 1 : -1;
  return (
    elements
      .map((element, index) => {
        const rect = element.getBoundingClientRect?.() || {
          left: index,
          top: index,
          width: 1,
          height: 1,
        };
        return {
          index,
          value: axis === 'x' ? rect.left + rect.width / 2 : rect.top + rect.height / 2,
        };
      })
      .sort((a, b) => sign * (b.value - a.value))[0]?.index ?? currentIndex
  );
}

export function readNavigationAction(gamepad, previous = null, { deadzone = 0.35 } = {}) {
  const current = normalizeGamepadState(gamepad, { deadzone });
  const wasPressed = (index) => Boolean(previous?.buttons[index]?.pressed);
  const rising = (index) => current.buttons[index]?.pressed && !wasPressed(index);
  if (rising(0)) return 'confirm';
  if (rising(1)) return 'cancel';
  const dpad = [
    [12, 'up'],
    [13, 'down'],
    [14, 'left'],
    [15, 'right'],
  ].find(([index]) => rising(index));
  if (dpad) return dpad[1];
  const previousAxes = previous?.axes || [];
  const axis = [
    [0, 'left', 'right'],
    [1, 'up', 'down'],
  ]
    .map(([index, negative, positive]) => {
      const value = current.axes[index] || 0;
      const prior = previousAxes[index] || 0;
      return value < -deadzone && prior >= -deadzone
        ? negative
        : value > deadzone && prior <= deadzone
          ? positive
          : null;
    })
    .find(Boolean);
  return axis || null;
}

export function readNavigationKey(event) {
  const key = String(event?.key || '');
  return (
    {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      Enter: 'confirm',
      ' ': 'confirm',
      Escape: 'cancel',
      BrowserBack: 'cancel',
      GoBack: 'cancel',
      Backspace: 'cancel',
    }[key] || null
  );
}

function applyNavigationAction(root, action, wrapNavigation) {
  const elements = [...(root?.querySelectorAll?.(FOCUSABLE_SELECTOR) || [])];
  if (!elements.length) return;
  const activeIndex = Math.max(0, elements.indexOf(root.activeElement));
  if (['up', 'down', 'left', 'right'].includes(action)) {
    const next = chooseFocusIndex(elements, activeIndex, action, { wrap: wrapNavigation });
    elements[next]?.focus?.();
  } else if (action === 'confirm') elements[activeIndex]?.click?.();
  else if (action === 'cancel') root.defaultView?.history?.back?.();
}

export function createControllerNavigator({
  root = globalThis.document,
  navigatorLike = globalThis.navigator,
  intervalMs = 100,
  deadzone = 0.35,
  wrapNavigation = false,
  keyboardTarget = root,
  scheduler = setInterval,
  clearScheduler = clearInterval,
  focusOnStart = root?.documentElement?.dataset?.spartanNavigation === 'remote-controller',
} = {}) {
  let timer = null;
  let previous = null;
  let selectedGamepad = null;
  const onKeyDown = (event) => {
    const action = readNavigationKey(event);
    if (!action) return;
    event.preventDefault?.();
    applyNavigationAction(root, action, wrapNavigation);
  };
  const poll = () => {
    const gamepads = [...(navigatorLike?.getGamepads?.() || [])].filter(Boolean);
    const gamepad = gamepads.find((item) => item.index === selectedGamepad) || gamepads[0];
    if (!gamepad) {
      previous = null;
      return;
    }
    selectedGamepad = gamepad.index;
    const action = readNavigationAction(gamepad, previous, { deadzone });
    previous = normalizeGamepadState(gamepad, { deadzone });
    if (action) applyNavigationAction(root, action, wrapNavigation);
  };
  return Object.freeze({
    get running() {
      return timer !== null;
    },
    start() {
      if (timer === null) {
        if (focusOnStart) focusFirstControl(root?.querySelectorAll?.(FOCUSABLE_SELECTOR) || []);
        keyboardTarget?.addEventListener?.('keydown', onKeyDown);
        timer = scheduler(poll, intervalMs);
      }
      return this;
    },
    stop() {
      if (timer !== null) clearScheduler(timer);
      keyboardTarget?.removeEventListener?.('keydown', onKeyDown);
      timer = null;
      previous = null;
      return this;
    },
    poll,
  });
}

export function syncRuntimeControllerNavigation(root = globalThis.document, options = {}) {
  if (!root) return null;
  const wantsControllerNavigation =
    root.documentElement?.dataset?.spartanNavigation === 'remote-controller';
  const existing = runtimeNavigators.get(root);
  if (!wantsControllerNavigation) {
    existing?.stop();
    runtimeNavigators.delete(root);
    return null;
  }
  if (existing) return existing;
  const navigator = createControllerNavigator({ root, focusOnStart: true, ...options });
  navigator.start();
  runtimeNavigators.set(root, navigator);
  return navigator;
}
