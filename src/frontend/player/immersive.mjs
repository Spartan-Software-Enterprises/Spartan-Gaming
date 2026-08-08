function eventBus() { const listeners = new Set(); return {on(handler) { listeners.add(handler); return () => listeners.delete(handler); }, emit(value) { listeners.forEach(handler => handler(value)); }}; }

function displayIndex(preference) {
  if (preference && typeof preference === 'object' && preference.kind === 'index' && Number.isInteger(preference.index) && preference.index >= 0) return preference.index;
  return null;
}

async function fullscreenOptions({preference, navigatorRef}) {
  const index = displayIndex(preference);
  if (index === null || typeof navigatorRef?.getScreenDetails !== 'function') return undefined;
  try {
    const details = await navigatorRef.getScreenDetails();
    const screen = details?.screens?.[index];
    return screen ? {screen} : undefined;
  } catch {
    return undefined;
  }
}

export function detectImmersiveCapabilities({documentRef = globalThis.document, navigatorRef = globalThis.navigator} = {}) {
  return Object.freeze({fullscreen: Boolean(documentRef?.fullscreenEnabled && documentRef?.exitFullscreen), pointerLock: Boolean(documentRef?.pointerLockElement !== undefined), keyboardLock: Boolean(navigatorRef?.keyboard?.lock && navigatorRef?.keyboard?.unlock)});
}

export function createImmersiveController({target, documentRef = globalThis.document, navigatorRef = globalThis.navigator, keyboardCodes = ['Escape', 'F11'], display = 'automatic'} = {}) {
  if (!target || typeof target.requestFullscreen !== 'function') throw new TypeError('target.requestFullscreen is required');
  const bus = eventBus(); const capabilities = detectImmersiveCapabilities({documentRef, navigatorRef}); let state = 'inactive'; let displayPreference = display;
  const publish = () => { state = documentRef?.fullscreenElement || documentRef?.pointerLockElement ? 'active' : 'inactive'; bus.emit({state, capabilities}); };
  const fullscreenListener = () => publish(); const pointerListener = () => publish();
  documentRef?.addEventListener?.('fullscreenchange', fullscreenListener); documentRef?.addEventListener?.('pointerlockchange', pointerListener);
  return Object.freeze({
    get state() { return state; }, get capabilities() { return capabilities; }, on: bus.on,
    setDisplayPreference(preference) { displayPreference = preference || 'automatic'; return displayPreference; },
    async enter() {
      const options = await fullscreenOptions({preference: displayPreference, navigatorRef});
      if (options) {
        try { await target.requestFullscreen(options); }
        catch { await target.requestFullscreen(); }
      } else await target.requestFullscreen();
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
