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
