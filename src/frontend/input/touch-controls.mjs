const LAYOUTS = Object.freeze({
  minimal: Object.freeze([
    Object.freeze({id: 'cancel', label: 'B', action: 'cancel', group: 'face'}),
    Object.freeze({id: 'confirm', label: 'A', action: 'confirm', group: 'face'}),
  ]),
  full: Object.freeze([
    Object.freeze({id: 'moveUp', label: '▲', action: 'moveUp', group: 'dpad'}),
    Object.freeze({id: 'moveLeft', label: '◀', action: 'moveLeft', group: 'dpad'}),
    Object.freeze({id: 'moveRight', label: '▶', action: 'moveRight', group: 'dpad'}),
    Object.freeze({id: 'moveDown', label: '▼', action: 'moveDown', group: 'dpad'}),
    Object.freeze({id: 'cancel', label: 'B', action: 'cancel', group: 'face'}),
    Object.freeze({id: 'confirm', label: 'A', action: 'confirm', group: 'face'}),
    Object.freeze({id: 'menu', label: '☰', action: 'menu', group: 'utility'}),
    Object.freeze({id: 'pause', label: 'Ⅱ', action: 'pause', group: 'utility'}),
  ]),
});

export function normalizeTouchLayout(value) {
  const normalized = String(value || 'Automatic').toLowerCase();
  if (normalized === 'minimal') return 'minimal';
  if (normalized === 'off' || normalized === 'disabled') return 'off';
  return 'full';
}

export function createTouchControlLayout(value = 'full') {
  const layout = normalizeTouchLayout(value);
  return Object.freeze((LAYOUTS[layout] || []).map(control => Object.freeze({...control})));
}

export function createTouchControlEvent({action, pressed, control = action} = {}) {
  if (typeof action !== 'string' || !action || action.length > 64) throw new TypeError('touch action is required');
  return Object.freeze({type: 'input.event', action, kind: 'button', source: 'touch', control, pressed: Boolean(pressed), value: pressed ? 1 : 0});
}

function axis(value) { return Math.max(-1, Math.min(1, Number(value) || 0)); }

/** Create the two normalized axis events represented by one virtual stick. */
export function createTouchStickEvents({index = 0, x = 0, y = 0, pressed = true} = {}) {
  if (!Number.isInteger(index) || index < 0 || index > 4 || index % 2 !== 0) throw new RangeError('touch stick index must be an even axis index from 0 through 4');
  const active = Boolean(pressed);
  const horizontal = axis(active ? x : 0);
  const vertical = axis(active ? y : 0);
  return Object.freeze([
    Object.freeze({type: 'input.event', action: `axis-${index}`, kind: 'axis', source: 'touch', control: `axis-${index}`, pressed: active && horizontal !== 0, value: horizontal}),
    Object.freeze({type: 'input.event', action: `axis-${index + 1}`, kind: 'axis', source: 'touch', control: `axis-${index + 1}`, pressed: active && vertical !== 0, value: vertical}),
  ]);
}
