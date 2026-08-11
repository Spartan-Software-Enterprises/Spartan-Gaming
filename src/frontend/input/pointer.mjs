function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number(value) || 0));
}

export function normalizePointerCoordinates({
  clientX = 0,
  clientY = 0,
  rect = { left: 0, top: 0, width: 1, height: 1 },
} = {}) {
  return Object.freeze({
    x: clamp((clientX - rect.left) / Math.max(1, rect.width), 0, 1),
    y: clamp((clientY - rect.top) / Math.max(1, rect.height), 0, 1),
  });
}

export function createPointerInputEvent({ event, rect } = {}) {
  if (!event || !['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].includes(event.type))
    throw new TypeError('A supported pointer event is required');
  const coordinates = normalizePointerCoordinates({
    clientX: event.clientX,
    clientY: event.clientY,
    rect,
  });
  const touch = event.pointerType === 'touch';
  const pressed =
    event.type === 'pointerdown' || (event.type === 'pointermove' && Number(event.buttons) > 0);
  return Object.freeze({
    type: 'input.event',
    action: `pointer:${event.type.replace('pointer', '')}`,
    kind: touch ? 'touch' : 'pointer',
    source: touch ? 'touch' : 'pointer',
    control: touch ? 'touch-contact' : `button-${Math.max(0, Number(event.button) || 0)}`,
    pressed,
    value: pressed ? 1 : 0,
    x: coordinates.x,
    y: coordinates.y,
    deltaX: Math.max(-4096, Math.min(4096, Number(event.movementX) || 0)),
    deltaY: Math.max(-4096, Math.min(4096, Number(event.movementY) || 0)),
  });
}

export function createWheelInputEvent({ event, rect } = {}) {
  if (!event || event.type !== 'wheel') throw new TypeError('A wheel event is required');
  const coordinates = normalizePointerCoordinates({
    clientX: event.clientX,
    clientY: event.clientY,
    rect,
  });
  return Object.freeze({
    type: 'input.event',
    action: 'pointer:wheel',
    kind: 'pointer',
    source: 'pointer',
    control: 'wheel',
    pressed: false,
    value: 0,
    x: coordinates.x,
    y: coordinates.y,
    deltaX: Math.max(-4096, Math.min(4096, Number(event.deltaX) || 0)),
    deltaY: Math.max(-4096, Math.min(4096, Number(event.deltaY) || 0)),
  });
}
