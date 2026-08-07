import test from 'node:test';
import assert from 'node:assert/strict';
import {createImmersiveController, detectImmersiveCapabilities} from './immersive.mjs';

function fakeDocument() { return {fullscreenEnabled: true, fullscreenElement: null, pointerLockElement: null, exitFullscreen() { this.fullscreenElement = null; }, exitPointerLock() { this.pointerLockElement = null; }, addEventListener() {}, removeEventListener() {}}; }

test('immersive capability detection is explicit and safe', () => { const documentRef = fakeDocument(); assert.deepEqual(detectImmersiveCapabilities({documentRef, navigatorRef: {keyboard: {lock() {}, unlock() {}}}}), {fullscreen: true, pointerLock: true, keyboardLock: true}); assert.equal(detectImmersiveCapabilities({documentRef: {}, navigatorRef: {}}).fullscreen, false); });

test('immersive controller enters and exits with optional locks', async () => { const documentRef = fakeDocument(); const navigatorRef = {keyboard: {locked: false, lock() { this.locked = true; }, unlock() { this.locked = false; }}}; const target = {requestFullscreen() { documentRef.fullscreenElement = target; }, requestPointerLock() { documentRef.pointerLockElement = target; }}; const controller = createImmersiveController({target, documentRef, navigatorRef}); await controller.enter(); assert.equal(controller.state, 'active'); assert.equal(navigatorRef.keyboard.locked, true); await controller.exit(); assert.equal(controller.state, 'inactive'); assert.equal(navigatorRef.keyboard.locked, false); controller.dispose(); });

test('immersive controller tolerates rejected optional Pointer Lock', async () => { const documentRef = fakeDocument(); const target = {requestFullscreen() { documentRef.fullscreenElement = target; }, requestPointerLock() { return Promise.reject(new Error('permission denied')); }}; const controller = createImmersiveController({target, documentRef, navigatorRef: {}}); await controller.enter(); assert.equal(controller.state, 'active'); });
