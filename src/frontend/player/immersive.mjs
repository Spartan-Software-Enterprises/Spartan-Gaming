function eventBus() { const listeners = new Set(); return {on(handler) { listeners.add(handler); return () => listeners.delete(handler); }, emit(value) { listeners.forEach(handler => handler(value)); }}; }

export function detectImmersiveCapabilities({documentRef = globalThis.document, navigatorRef = globalThis.navigator} = {}) {
  return Object.freeze({fullscreen: Boolean(documentRef?.fullscreenEnabled && documentRef?.exitFullscreen), pointerLock: Boolean(documentRef?.pointerLockElement !== undefined), keyboardLock: Boolean(navigatorRef?.keyboard?.lock && navigatorRef?.keyboard?.unlock)});
}

export function createImmersiveController({target, documentRef = globalThis.document, navigatorRef = globalThis.navigator, keyboardCodes = ['Escape', 'F11']} = {}) {
  if (!target || typeof target.requestFullscreen !== 'function') throw new TypeError('target.requestFullscreen is required');
  const bus = eventBus(); const capabilities = detectImmersiveCapabilities({documentRef, navigatorRef}); let state = 'inactive';
  const publish = () => { state = documentRef?.fullscreenElement || documentRef?.pointerLockElement ? 'active' : 'inactive'; bus.emit({state, capabilities}); };
  const fullscreenListener = () => publish(); const pointerListener = () => publish();
  documentRef?.addEventListener?.('fullscreenchange', fullscreenListener); documentRef?.addEventListener?.('pointerlockchange', pointerListener);
  return Object.freeze({
    get state() { return state; }, get capabilities() { return capabilities; }, on: bus.on,
    async enter() {
      await target.requestFullscreen();
      if (typeof target.requestPointerLock === 'function') { try { await target.requestPointerLock(); } catch { /* Pointer Lock may require a separate permission gesture. */ } }
      if (capabilities.keyboardLock) { try { await navigatorRef.keyboard.lock(keyboardCodes); } catch { /* Keyboard Lock is optional and browser-policy controlled. */ } }
      publish(); return state;
    },
    async exit() {
      if (capabilities.keyboardLock) navigatorRef.keyboard.unlock();
      if (documentRef?.pointerLockElement && documentRef.exitPointerLock) documentRef.exitPointerLock();
      if (documentRef?.fullscreenElement && documentRef.exitFullscreen) await documentRef.exitFullscreen();
      publish(); return state;
    },
    async toggle() { return state === 'active' ? this.exit() : this.enter(); },
    dispose() { documentRef?.removeEventListener?.('fullscreenchange', fullscreenListener); documentRef?.removeEventListener?.('pointerlockchange', pointerListener); },
  });
}
