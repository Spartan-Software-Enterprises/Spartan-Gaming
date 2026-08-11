import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld(
  'spartanElectron',
  Object.freeze({
    platform: process.platform,
    isElectron: true,
    openExternal(url) {
      return ipcRenderer.invoke('spartan:open-external', url);
    },
    openProvider(url, title, sessionOptions) {
      return ipcRenderer.invoke('spartan:open-provider', { url, title, sessionOptions });
    },
    closeProvider() {
      return ipcRenderer.invoke('spartan:close-provider');
    },
    clearProviderLogins() {
      return ipcRenderer.invoke('spartan:clear-provider-logins');
    },
    setQuitGuard(enabled) {
      return ipcRenderer.invoke('spartan:set-quit-guard', enabled);
    },
    setSessionActive(active) {
      return ipcRenderer.invoke('spartan:set-session-active', active);
    },
    applyRuntimeSettings(settings) {
      return ipcRenderer.invoke('spartan:apply-runtime-settings', settings);
    },
    toggleFullscreen() {
      return ipcRenderer.invoke('spartan:toggle-fullscreen');
    },
    onFullscreenChanged(callback) {
      const listener = (_event, value) => callback(value);
      ipcRenderer.on('spartan:fullscreen-changed', listener);
      return () => ipcRenderer.removeListener('spartan:fullscreen-changed', listener);
    },
    onPowerEvent(callback) {
      const listener = (_event, value) => callback(value);
      ipcRenderer.on('spartan:power-event', listener);
      return () => ipcRenderer.removeListener('spartan:power-event', listener);
    },
    onDeepLink(callback) {
      if (typeof callback !== 'function') return () => {};
      const listener = (_event, value) => callback(value);
      ipcRenderer.on('spartan:deep-link', listener);
      return () => ipcRenderer.removeListener('spartan:deep-link', listener);
    },
  }),
);
