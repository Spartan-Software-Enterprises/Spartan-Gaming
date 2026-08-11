import { normalizeGlobalShortcut } from '../../src/frontend/settings/electron-runtime.mjs';

export function createGlobalShortcutController({ registry, onActivate } = {}) {
  if (
    !registry ||
    typeof registry.register !== 'function' ||
    typeof registry.unregister !== 'function'
  )
    throw new TypeError('global shortcut registry is required');
  if (typeof onActivate !== 'function')
    throw new TypeError('global shortcut activation handler is required');
  let accelerator = null;
  let state = Object.freeze({ status: 'disabled', accelerator: null });

  function sync(value) {
    const desired = normalizeGlobalShortcut(value);
    if (desired === accelerator && state.status === 'registered') return state;
    if (accelerator) {
      registry.unregister(accelerator);
      accelerator = null;
    }
    if (!desired) {
      state = Object.freeze({ status: 'disabled', accelerator: null });
      return state;
    }
    try {
      if (!registry.register(desired, onActivate)) {
        state = Object.freeze({ status: 'unavailable', accelerator: desired });
        return state;
      }
      accelerator = desired;
      state = Object.freeze({ status: 'registered', accelerator });
      return state;
    } catch {
      state = Object.freeze({ status: 'unavailable', accelerator: desired });
      return state;
    }
  }

  function dispose() {
    if (accelerator) registry.unregister(accelerator);
    accelerator = null;
    state = Object.freeze({ status: 'disabled', accelerator: null });
  }

  return Object.freeze({
    sync,
    dispose,
    get state() {
      return state;
    },
  });
}
