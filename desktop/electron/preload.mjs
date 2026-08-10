import {contextBridge, ipcRenderer} from 'electron';

contextBridge.exposeInMainWorld('spartanElectron', Object.freeze({
  platform: process.platform,
  isElectron: true,
  openExternal(url) { return ipcRenderer.invoke('spartan:open-external', url); },
  openProvider(url, title) { return ipcRenderer.invoke('spartan:open-provider', {url, title}); },
  closeProvider() { return ipcRenderer.invoke('spartan:close-provider'); },
  toggleFullscreen() { return ipcRenderer.invoke('spartan:toggle-fullscreen'); },
  onFullscreenChanged(callback) { const listener = (_event, value) => callback(value); ipcRenderer.on('spartan:fullscreen-changed', listener); return () => ipcRenderer.removeListener('spartan:fullscreen-changed', listener); },
}));

