const ACTIONS = Object.freeze([
  Object.freeze({id: 'confirm', label: 'Confirm', type: 'button'}),
  Object.freeze({id: 'cancel', label: 'Cancel', type: 'button'}),
  Object.freeze({id: 'menu', label: 'Menu', type: 'button'}),
  Object.freeze({id: 'view', label: 'View', type: 'button'}),
  Object.freeze({id: 'pause', label: 'Pause', type: 'button'}),
  Object.freeze({id: 'move', label: 'Move', type: 'joystick'}),
  Object.freeze({id: 'look', label: 'Look', type: 'joystick'}),
  Object.freeze({id: 'south', label: 'South face button', type: 'button'}),
  Object.freeze({id: 'east', label: 'East face button', type: 'button'}),
  Object.freeze({id: 'west', label: 'West face button', type: 'button'}),
  Object.freeze({id: 'north', label: 'North face button', type: 'button'}),
]);

const FAMILIES = new Set(['automatic', 'xbox', 'playstation', 'nintendo', 'steam']);
const MODES = new Set(['fallback', 'official-actions']);
const GLYPHS = Object.freeze({
  xbox: Object.freeze({confirm: 'A', cancel: 'B', menu: 'Menu', view: 'View', pause: 'Menu'}),
  playstation: Object.freeze({confirm: 'Cross', cancel: 'Circle', menu: 'Options', view: 'Create', pause: 'Options'}),
  nintendo: Object.freeze({confirm: 'B', cancel: 'A', menu: '+', view: '-', pause: '+'}),
  steam: Object.freeze({confirm: 'A', cancel: 'B', menu: 'Menu', view: 'View', pause: 'Menu'}),
});

function bounded(value, name, maximum = 128) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum || /[\u0000\r\n]/.test(value)) throw new TypeError(`${name} must be a bounded string`);
  return value.trim();
}

/** Describe the shared action vocabulary an optional Steam Input bridge may consume. */
export function createSteamInputActionManifest({title = 'Spartan Gaming', actions = ACTIONS} = {}) {
  const name = bounded(title, 'title', 160);
  if (!Array.isArray(actions) || actions.length < 1 || actions.length > 64) throw new TypeError('Steam Input actions must be a bounded array');
  const normalized = actions.map(action => Object.freeze({id: bounded(action?.id, 'action.id', 64), label: bounded(action?.label, 'action.label', 128), type: bounded(action?.type, 'action.type', 32)}));
  const ids = new Set(); for (const action of normalized) { if (ids.has(action.id)) throw new Error(`duplicate Steam Input action: ${action.id}`); ids.add(action.id); }
  return Object.freeze({version: 1, kind: 'steam-input-action-manifest', title: name, actions: Object.freeze(normalized), bridge: 'optional', fallback: 'gamepad-hid'});
}

/** Normalize the optional, installed bridge without granting undocumented Steam-client control. */
export function resolveSteamInputCapability({mode = 'fallback', bridge} = {}) {
  if (!MODES.has(mode)) throw new TypeError('Steam Input mode is unsupported');
  const available = mode === 'official-actions' && typeof bridge?.getGlyph === 'function' && typeof bridge?.getActionState === 'function';
  return Object.freeze({mode, state: available ? 'ready' : 'fallback', officialActions: available, fallback: true, requires: available ? Object.freeze([]) : Object.freeze(['gamepad-or-hid-input'])});
}

/** Resolve a display-safe glyph token from an official bridge or portable family fallback. */
export function resolveSteamInputGlyph({action, family = 'automatic', bridge} = {}) {
  const actionId = bounded(action, 'action', 64);
  const bridgeGlyph = typeof bridge?.getGlyph === 'function' ? bridge.getGlyph(actionId) : null;
  if (typeof bridgeGlyph === 'string' && bridgeGlyph.trim() && bridgeGlyph.length <= 64 && !/[\u0000\r\n]/.test(bridgeGlyph)) return Object.freeze({source: 'official-actions', action: actionId, glyph: bridgeGlyph.trim()});
  const selected = family === 'automatic' ? 'xbox' : family;
  if (!FAMILIES.has(selected)) throw new TypeError('controller glyph family is unsupported');
  return Object.freeze({source: 'fallback', action: actionId, glyph: GLYPHS[selected]?.[actionId] || actionId});
}

export const STEAM_INPUT_ACTIONS = ACTIONS;
export const STEAM_INPUT_GLYPH_FAMILIES = Object.freeze([...FAMILIES]);
