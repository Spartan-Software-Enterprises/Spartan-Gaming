import {contextBridge, ipcRenderer} from 'electron';

contextBridge.exposeInMainWorld('spartanElectron', Object.freeze({
  platform: process.platform,
  isElectron: true,
  openExternal(url) { return ipcRenderer.invoke('spartan:open-external', url); },
  openProvider(url, title) { return ipcRenderer.invoke('spartan:open-provider', {url, title}); },
  closeProvider() { return ipcRenderer.invoke('spartan:close-provider'); },
  setQuitGuard(enabled) { return ipcRenderer.invoke('spartan:set-quit-guard', enabled); },
  setSessionActive(active) { return ipcRenderer.invoke('spartan:set-session-active', active); },
  applyRuntimeSettings(settings) { return ipcRenderer.invoke('spartan:apply-runtime-settings', settings); },
  toggleFullscreen() { return ipcRenderer.invoke('spartan:toggle-fullscreen'); },
  onFullscreenChanged(callback) { const listener = (_event, value) => callback(value); ipcRenderer.on('spartan:fullscreen-changed', listener); return () => ipcRenderer.removeListener('spartan:fullscreen-changed', listener); },
  onPowerEvent(callback) { const listener = (_event, value) => callback(value); ipcRenderer.on('spartan:power-event', listener); return () => ipcRenderer.removeListener('spartan:power-event', listener); },
}));
