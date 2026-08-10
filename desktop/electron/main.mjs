import {app, BrowserWindow, Menu, ipcMain, shell, WebContentsView} from 'electron';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createFrontendServer} from '../../scripts/frontend/serve.mjs';
import {isAllowedExternalUrl, isAllowedNavigation, isAllowedProviderUrl} from './security.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let frontend;
let windowRef;
let providerView;

function closeProviderView() {
  if (!providerView) return false;
  windowRef.contentView.removeChildView(providerView);
  providerView.webContents.close();
  providerView = null;
  windowRef.setTitle('Spartan Gaming');
  return true;
}

function createProviderView(url, title = 'Provider Player') {
  if (!isAllowedProviderUrl(url)) throw new Error('Provider Player requires an HTTPS URL.');
  closeProviderView();
  providerView = new WebContentsView({webPreferences: {contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, partition: 'persist:spartan-gaming-providers'}});
  providerView.webContents.setWindowOpenHandler(({url: popupUrl}) => { if (isAllowedProviderUrl(popupUrl)) { void providerView.webContents.loadURL(popupUrl); } else { void shell.openExternal(popupUrl); } return {action: 'deny'}; });
  providerView.webContents.on('will-navigate', event => { if (!isAllowedProviderUrl(event.url)) event.preventDefault(); });
  providerView.webContents.on('enter-full-screen', () => windowRef.webContents.send('spartan:fullscreen-changed', true));
  providerView.webContents.on('leave-full-screen', () => windowRef.webContents.send('spartan:fullscreen-changed', false));
  windowRef.contentView.addChildView(providerView);
  resizeProvider();
  void providerView.webContents.loadURL(url);
  windowRef.setTitle(`Spartan Gaming — ${title}`);
}

function resizeProvider() { if (!providerView || !windowRef) return; const {width, height} = windowRef.getContentBounds(); providerView.setBounds({x: 0, y: 0, width, height}); }

async function createMainWindow() {
  frontend = createFrontendServer({host: '127.0.0.1', port: 0, root: path.join(repositoryRoot, 'src/frontend'), publicRoot: repositoryRoot});
  const address = await frontend.listen();
  const origin = `http://127.0.0.1:${address.port}`;
  windowRef = new BrowserWindow({width: 1440, height: 900, minWidth: 960, minHeight: 640, title: 'Spartan Gaming', backgroundColor: '#10151b', webPreferences: {contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(repositoryRoot, 'desktop/electron/preload.mjs')}});
  windowRef.on('resize', resizeProvider);
  windowRef.webContents.on('will-navigate', event => { if (!isAllowedNavigation(event.url, {frontendOrigin: origin})) { event.preventDefault(); try { void shell.openExternal(new URL(event.url).href); } catch {} } });
  windowRef.webContents.setWindowOpenHandler(({url}) => { if (isAllowedNavigation(url, {frontendOrigin: origin})) return {action: 'allow'}; try { void shell.openExternal(new URL(url).href); } catch {} return {action: 'deny'}; });
  windowRef.webContents.on('before-input-event', (_event, input) => { if (input.type === 'keyDown' && input.key === 'Escape') closeProviderView(); });
  await windowRef.loadURL(`${origin}/dashboard/?startup=1`);
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label: 'Spartan Gaming', submenu: [{role: 'about'}, {type: 'separator'}, {role: 'quit'}]}, {label: 'View', submenu: [{role: 'togglefullscreen'}, {role: 'reload'}, {role: 'toggledevtools'}]}]));
  ipcMain.handle('spartan:open-external', (_event, url) => { if (!isAllowedExternalUrl(url)) throw new Error('External links require HTTPS or a loopback HTTP URL.'); return shell.openExternal(new URL(url).href); });
  ipcMain.handle('spartan:open-provider', (_event, {url, title}) => createProviderView(url, title));
  ipcMain.handle('spartan:close-provider', closeProviderView);
  ipcMain.handle('spartan:toggle-fullscreen', () => { windowRef.setFullScreen(!windowRef.isFullScreen()); return windowRef.isFullScreen(); });
  await createMainWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) void createMainWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', async () => { await frontend?.close().catch(() => {}); });
