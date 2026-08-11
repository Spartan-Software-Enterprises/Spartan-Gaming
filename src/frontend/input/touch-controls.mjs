const CONTROLS = Object.freeze({
  cancel: 'button-1',
  confirm: 'button-0',
  lb: 'button-4',
  lt: 'button-6',
  rb: 'button-5',
  rt: 'button-7',
  moveUp: 'button-12',
  moveDown: 'button-13',
  moveLeft: 'button-14',
  moveRight: 'button-15',
  menu: 'button-9',
  pause: 'button-8',
  l3: 'button-10',
  r3: 'button-11',
});

const LAYOUTS = Object.freeze({
  minimal: Object.freeze([
    Object.freeze({
      id: 'cancel',
      label: 'B',
      action: 'cancel',
      group: 'face',
      control: 'button-1',
    }),
    Object.freeze({
      id: 'confirm',
      label: 'A',
      action: 'confirm',
      group: 'face',
      control: 'button-0',
    }),
  ]),
  full: Object.freeze([
    Object.freeze({
      id: 'lb',
      label: 'L1',
      action: 'lb',
      group: 'shoulder',
      side: 'left',
      control: 'button-4',
    }),
    Object.freeze({
      id: 'lt',
      label: 'L2',
      action: 'lt',
      group: 'shoulder',
      side: 'left',
      control: 'button-6',
    }),
    Object.freeze({
      id: 'rb',
      label: 'R1',
      action: 'rb',
      group: 'shoulder',
      side: 'right',
      control: 'button-5',
    }),
    Object.freeze({
      id: 'rt',
      label: 'R2',
      action: 'rt',
      group: 'shoulder',
      side: 'right',
      control: 'button-7',
    }),
    Object.freeze({
      id: 'moveUp',
      label: '▲',
      action: 'moveUp',
      group: 'dpad',
      control: 'button-12',
    }),
    Object.freeze({
      id: 'moveLeft',
      label: '◀',
      action: 'moveLeft',
      group: 'dpad',
      control: 'button-14',
    }),
    Object.freeze({
      id: 'moveRight',
      label: '▶',
      action: 'moveRight',
      group: 'dpad',
      control: 'button-15',
    }),
    Object.freeze({
      id: 'moveDown',
      label: '▼',
      action: 'moveDown',
      group: 'dpad',
      control: 'button-13',
    }),
    Object.freeze({
      id: 'cancel',
      label: 'B',
      action: 'cancel',
      group: 'face',
      control: 'button-1',
    }),
    Object.freeze({
      id: 'confirm',
      label: 'A',
      action: 'confirm',
      group: 'face',
      control: 'button-0',
    }),
    Object.freeze({
      id: 'menu',
      label: '☰',
      action: 'menu',
      group: 'utility',
      control: 'button-9',
    }),
    Object.freeze({
      id: 'pause',
      label: 'Ⅱ',
      action: 'pause',
      group: 'utility',
      control: 'button-8',
    }),
    Object.freeze({
      id: 'l3',
      label: 'L3',
      action: 'l3',
      group: 'stick-click',
      side: 'left',
      control: 'button-10',
    }),
    Object.freeze({
      id: 'r3',
      label: 'R3',
      action: 'r3',
      group: 'stick-click',
      side: 'right',
      control: 'button-11',
    }),
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
  return Object.freeze((LAYOUTS[layout] || []).map((control) => Object.freeze({ ...control })));
}

export function createTouchControlEvent({
  action,
  pressed,
  control = CONTROLS[action] || action,
} = {}) {
  if (typeof action !== 'string' || !action || action.length > 64)
    throw new TypeError('touch action is required');
  return Object.freeze({
    type: 'input.event',
    action,
    kind: 'button',
    source: 'touch',
    control,
    pressed: Boolean(pressed),
    value: pressed ? 1 : 0,
  });
}

function axis(value) {
  return Math.max(-1, Math.min(1, Number(value) || 0));
}

/** Create the two normalized axis events represented by one virtual stick. */
export function createTouchStickEvents({ index = 0, x = 0, y = 0, pressed = true } = {}) {
  if (!Number.isInteger(index) || index < 0 || index > 4 || index % 2 !== 0)
    throw new RangeError('touch stick index must be an even axis index from 0 through 4');
  const active = Boolean(pressed);
  const horizontal = axis(active ? x : 0);
  const vertical = axis(active ? y : 0);
  return Object.freeze([
    Object.freeze({
      type: 'input.event',
      action: `axis-${index}`,
      kind: 'axis',
      source: 'touch',
      control: `axis-${index}`,
      pressed: active && horizontal !== 0,
      value: horizontal,
    }),
    Object.freeze({
      type: 'input.event',
      action: `axis-${index + 1}`,
      kind: 'axis',
      source: 'touch',
      control: `axis-${index + 1}`,
      pressed: active && vertical !== 0,
      value: vertical,
    }),
  ]);
}
