const ACTIONS = Object.freeze([
  Object.freeze({ id: 'confirm', label: 'Confirm', type: 'button' }),
  Object.freeze({ id: 'cancel', label: 'Cancel', type: 'button' }),
  Object.freeze({ id: 'menu', label: 'Menu', type: 'button' }),
  Object.freeze({ id: 'view', label: 'View', type: 'button' }),
  Object.freeze({ id: 'pause', label: 'Pause', type: 'button' }),
  Object.freeze({ id: 'move', label: 'Move', type: 'joystick' }),
  Object.freeze({ id: 'look', label: 'Look', type: 'joystick' }),
  Object.freeze({
    id: 'trackpad-left',
    label: 'Left trackpad',
    type: 'trackpad',
    requires: ['trackpads'],
  }),
  Object.freeze({
    id: 'trackpad-right',
    label: 'Right trackpad',
    type: 'trackpad',
    requires: ['trackpads'],
  }),
  Object.freeze({ id: 'gyro', label: 'Gyroscope', type: 'motion', requires: ['gyro'] }),
  Object.freeze({
    id: 'rear-left',
    label: 'Left rear button',
    type: 'button',
    requires: ['back-buttons'],
  }),
  Object.freeze({
    id: 'rear-right',
    label: 'Right rear button',
    type: 'button',
    requires: ['back-buttons'],
  }),
  Object.freeze({
    id: 'touchscreen',
    label: 'Touchscreen',
    type: 'touch',
    requires: ['touchscreen'],
  }),
  Object.freeze({
    id: 'text-entry',
    label: 'On-screen text entry',
    type: 'text',
    requires: ['text-entry'],
  }),
  Object.freeze({
    id: 'haptic-feedback',
    label: 'Haptic feedback',
    type: 'output',
    requires: ['haptics'],
  }),
  Object.freeze({
    id: 'controller-navigation',
    label: 'Controller-only navigation',
    type: 'navigation',
    requires: ['controller-navigation'],
  }),
  Object.freeze({ id: 'south', label: 'South face button', type: 'button' }),
  Object.freeze({ id: 'east', label: 'East face button', type: 'button' }),
  Object.freeze({ id: 'west', label: 'West face button', type: 'button' }),
  Object.freeze({ id: 'north', label: 'North face button', type: 'button' }),
]);

const FAMILIES = new Set(['automatic', 'xbox', 'playstation', 'nintendo', 'steam']);
const MODES = new Set(['fallback', 'official-actions']);
const GLYPHS = Object.freeze({
  xbox: Object.freeze({ confirm: 'A', cancel: 'B', menu: 'Menu', view: 'View', pause: 'Menu' }),
  playstation: Object.freeze({
    confirm: 'Cross',
    cancel: 'Circle',
    menu: 'Options',
    view: 'Create',
    pause: 'Options',
  }),
  nintendo: Object.freeze({ confirm: 'B', cancel: 'A', menu: '+', view: '-', pause: '+' }),
  steam: Object.freeze({ confirm: 'A', cancel: 'B', menu: 'Menu', view: 'View', pause: 'Menu' }),
});

function bounded(value, name, maximum = 128) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > maximum ||
    /[\u0000\r\n]/.test(value)
  )
    throw new TypeError(`${name} must be a bounded string`);
  return value.trim();
}

/** Describe the shared action vocabulary an optional Steam Input bridge may consume. */
export function createSteamInputActionManifest({
  title = 'Spartan Gaming',
  actions = ACTIONS,
} = {}) {
  const name = bounded(title, 'title', 160);
  if (!Array.isArray(actions) || actions.length < 1 || actions.length > 64)
    throw new TypeError('Steam Input actions must be a bounded array');
  const normalized = actions.map((action) => {
    const requires = Array.isArray(action?.requires)
      ? [...new Set(action.requires.map((value) => bounded(value, 'action.requires', 64)))]
      : [];
    return Object.freeze({
      id: bounded(action?.id, 'action.id', 64),
      label: bounded(action?.label, 'action.label', 128),
      type: bounded(action?.type, 'action.type', 32),
      requires: Object.freeze(requires),
    });
  });
  const ids = new Set();
  for (const action of normalized) {
    if (ids.has(action.id)) throw new Error(`duplicate Steam Input action: ${action.id}`);
    ids.add(action.id);
  }
  return Object.freeze({
    version: 1,
    kind: 'steam-input-action-manifest',
    title: name,
    actions: Object.freeze(normalized),
    bridge: 'optional',
    fallback: 'gamepad-hid',
  });
}

/** Negotiate action-level controller capabilities without claiming hardware support. */
export function negotiateSteamInputActions({
  manifest = createSteamInputActionManifest(),
  capabilities = [],
} = {}) {
  if (
    !manifest ||
    manifest.kind !== 'steam-input-action-manifest' ||
    !Array.isArray(manifest.actions)
  )
    throw new TypeError('a valid Steam Input action manifest is required');
  if (!Array.isArray(capabilities))
    throw new TypeError('Steam Input capabilities must be an array');
  const available = new Set(capabilities.filter((value) => typeof value === 'string'));
  const supported = manifest.actions.filter((action) =>
    action.requires.every((requirement) => available.has(requirement)),
  );
  const unavailable = manifest.actions
    .filter((action) => !action.requires.every((requirement) => available.has(requirement)))
    .map((action) =>
      Object.freeze({
        id: action.id,
        missing: Object.freeze(
          action.requires.filter((requirement) => !available.has(requirement)),
        ),
      }),
    );
  return Object.freeze({
    manifestVersion: manifest.version,
    supportedActions: Object.freeze(supported.map((action) => action.id)),
    unavailableActions: Object.freeze(unavailable),
    fallback: manifest.fallback,
    capabilities: Object.freeze([...available]),
  });
}

/** Normalize the optional, installed bridge without granting undocumented Steam-client control. */
export function resolveSteamInputCapability({ mode = 'fallback', bridge } = {}) {
  if (!MODES.has(mode)) throw new TypeError('Steam Input mode is unsupported');
  const available =
    mode === 'official-actions' &&
    typeof bridge?.getGlyph === 'function' &&
    typeof bridge?.getActionState === 'function';
  return Object.freeze({
    mode,
    state: available ? 'ready' : 'fallback',
    officialActions: available,
    fallback: true,
    requires: available ? Object.freeze([]) : Object.freeze(['gamepad-or-hid-input']),
  });
}

/** Resolve a display-safe glyph token from an official bridge or portable family fallback. */
export function resolveSteamInputGlyph({ action, family = 'automatic', bridge } = {}) {
  const actionId = bounded(action, 'action', 64);
  const bridgeGlyph = typeof bridge?.getGlyph === 'function' ? bridge.getGlyph(actionId) : null;
  if (
    typeof bridgeGlyph === 'string' &&
    bridgeGlyph.trim() &&
    bridgeGlyph.length <= 64 &&
    !/[\u0000\r\n]/.test(bridgeGlyph)
  )
    return Object.freeze({
      source: 'official-actions',
      action: actionId,
      glyph: bridgeGlyph.trim(),
    });
  const selected = family === 'automatic' ? 'xbox' : family;
  if (!FAMILIES.has(selected)) throw new TypeError('controller glyph family is unsupported');
  return Object.freeze({
    source: 'fallback',
    action: actionId,
    glyph: GLYPHS[selected]?.[actionId] || actionId,
  });
}

export const STEAM_INPUT_ACTIONS = ACTIONS;
export const STEAM_INPUT_GLYPH_FAMILIES = Object.freeze([...FAMILIES]);
