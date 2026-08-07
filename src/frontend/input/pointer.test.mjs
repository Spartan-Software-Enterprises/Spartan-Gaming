import assert from 'node:assert/strict';
import test from 'node:test';
import {createPointerInputEvent, normalizePointerCoordinates} from './pointer.mjs';

test('pointer coordinates normalize to the stream viewport', () => { assert.deepEqual(normalizePointerCoordinates({clientX: 150, clientY: 250, rect: {left: 100, top: 200, width: 100, height: 100}}), {x: 0.5, y: 0.5}); });
test('pointer and touch events become bounded remote input events', () => { const pointer = createPointerInputEvent({event: {type: 'pointermove', pointerType: 'mouse', clientX: 50, clientY: 25, buttons: 1, button: 0, movementX: 6000, movementY: -6000}, rect: {left: 0, top: 0, width: 100, height: 50}}); assert.equal(pointer.kind, 'pointer'); assert.equal(pointer.pressed, true); assert.equal(pointer.deltaX, 4096); assert.equal(pointer.deltaY, -4096); const touch = createPointerInputEvent({event: {type: 'pointerdown', pointerType: 'touch', clientX: 20, clientY: 20}, rect: {left: 0, top: 0, width: 100, height: 100}}); assert.equal(touch.source, 'touch'); assert.equal(touch.control, 'touch-contact'); });
test('pointer normalizer rejects unrelated events', () => { assert.throws(() => createPointerInputEvent({event: {type: 'click'}}), /pointer event/); });
