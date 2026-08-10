import {app, BrowserWindow, Menu, Tray, nativeImage, dialog, ipcMain, shell, WebContentsView, powerMonitor, powerSaveBlocker} from 'electron';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createFrontendServer} from '../../scripts/frontend/serve.mjs';
import {isAllowedExternalUrl, isAllowedNavigation, isAllowedProviderUrl} from './security.mjs';
import {applyElectronPrivacyHeaders, normalizeElectronRuntimePolicy, resolvePermissionDecision, shouldQuitWhenWindowsClose} from './runtime-policy.mjs';
import {createTrayMenuTemplate, shouldCreateTray} from './tray-policy.mjs';
import {normalizePowerEvent, resolvePowerSaveBlockerType} from './power-runtime.mjs';
import {findSpartanDeepLink} from './deep-links.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let frontend;
let windowRef;
let providerView;
let trayRef;
let quitGuardEnabled = true;
let sessionActive = false;
let quitting = false;
let runtimePolicy = normalizeElectronRuntimePolicy();
let powerBlockerId = null;
let powerBlockerType = null;
const privacySessions = new WeakSet();
const permissionDecisions = new Map();
const hasSingleInstanceLock = app.requestSingleInstanceLock();
let pendingDeepLink = findSpartanDeepLink(process.argv);

function installPrivacyPolicy(session) {
  if (!session || privacySessions.has(session)) return;
  privacySessions.add(session);
  session.webRequest.onBeforeSendHeaders((details, callback) => callback({requestHeaders: applyElectronPrivacyHeaders(details.requestHeaders, details, runtimePolicy)}));
  session.setPermissionRequestHandler((webContents, permission, callback, details = {}) => {
    const requestingOrigin = (() => { try { return new URL(details.requestingUrl || webContents.getURL()).origin; } catch { return ''; } })();
    const decisionKey = `${requestingOrigin}\n${permission}`;
    const decision = resolvePermissionDecision(runtimePolicy, {storedDecision: permissionDecisions.get(decisionKey)});
    if (decision !== null) { callback(decision); return; }
    if (!windowRef || !requestingOrigin) { callback(false); return; }
    void dialog.showMessageBox(windowRef, {type: 'question', buttons: ['Block', 'Allow'], defaultId: 0, cancelId: 0, title: 'Permission request', message: `${requestingOrigin} requests ${permission} access.`}).then(result => {
      const allowed = result.response === 1;
      if (runtimePolicy.permissionPrompts === 'Ask per site') permissionDecisions.set(decisionKey, allowed);
      callback(allowed);
    }).catch(() => callback(false));
  });
}

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
  installPrivacyPolicy(providerView.webContents.session);
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

function showMainWindow() { if (!windowRef) return; windowRef.show(); windowRef.focus(); }

function deliverDeepLink(link) {
  if (!link) return;
  if (!windowRef?.webContents || windowRef.webContents.isLoading()) { pendingDeepLink = link; return; }
  windowRef.webContents.send('spartan:deep-link', link);
}

function createTrayIcon() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#10151b"/><path d="M8 24 16 7l8 17-8-4-8 4Z" fill="#50e1d1"/></svg>';
  return nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
}

function destroyTray() { trayRef?.destroy(); trayRef = null; }

function syncPowerSaveBlocker() {
  const desired = resolvePowerSaveBlockerType({active: sessionActive, powerMode: runtimePolicy.powerMode});
  if (desired === powerBlockerType && powerBlockerId !== null) return;
  if (powerBlockerId !== null) { try { powerSaveBlocker.stop(powerBlockerId); } catch {} powerBlockerId = null; powerBlockerType = null; }
  if (!desired) return;
  try { powerBlockerId = powerSaveBlocker.start(desired); powerBlockerType = desired; } catch { powerBlockerId = null; powerBlockerType = null; }
}

function broadcastPowerEvent(type, details = {}) { windowRef?.webContents.send('spartan:power-event', normalizePowerEvent(type, details)); }

function installPowerMonitoring() {
  for (const event of ['suspend', 'resume', 'on-battery', 'on-ac', 'shutdown', 'lock-screen', 'unlock-screen']) powerMonitor.on(event, () => broadcastPowerEvent(event));
  powerMonitor.on('thermal-state-change', (_event, details) => broadcastPowerEvent('thermal-state-change', details));
  powerMonitor.on('speed-limit-change', (_event, details) => broadcastPowerEvent('speed-limit-change', details));
}

function syncTray() {
  if (!shouldCreateTray(runtimePolicy) || trayRef) return;
  trayRef = new Tray(createTrayIcon());
  trayRef.setToolTip('Spartan Gaming');
  trayRef.setContextMenu(Menu.buildFromTemplate(createTrayMenuTemplate({onShow: showMainWindow, onQuit: () => app.quit()})));
  trayRef.on('click', showMainWindow);
}

async function createMainWindow() {
  frontend = createFrontendServer({host: '127.0.0.1', port: 0, root: path.join(repositoryRoot, 'src/frontend'), publicRoot: repositoryRoot});
  const address = await frontend.listen();
  const origin = `http://127.0.0.1:${address.port}`;
  windowRef = new BrowserWindow({width: 1440, height: 900, minWidth: 960, minHeight: 640, title: 'Spartan Gaming', backgroundColor: '#10151b', webPreferences: {contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(repositoryRoot, 'desktop/electron/preload.mjs')}});
  installPrivacyPolicy(windowRef.webContents.session);
  windowRef.on('resize', resizeProvider);
  windowRef.webContents.on('will-navigate', event => { if (!isAllowedNavigation(event.url, {frontendOrigin: origin})) { event.preventDefault(); try { void shell.openExternal(new URL(event.url).href); } catch {} } });
  windowRef.webContents.setWindowOpenHandler(({url}) => { if (isAllowedNavigation(url, {frontendOrigin: origin})) return {action: 'allow'}; try { void shell.openExternal(new URL(url).href); } catch {} return {action: 'deny'}; });
  windowRef.webContents.on('before-input-event', (_event, input) => { if (input.type === 'keyDown' && input.key === 'Escape') closeProviderView(); });
  await windowRef.loadURL(`${origin}/dashboard/?startup=1`);
  deliverDeepLink(pendingDeepLink);
  pendingDeepLink = null;
}

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => { showMainWindow(); deliverDeepLink(findSpartanDeepLink(commandLine)); });
  app.on('open-url', (event, value) => { event.preventDefault(); showMainWindow(); deliverDeepLink(findSpartanDeepLink([value])); });
}

if (hasSingleInstanceLock) app.whenReady().then(async () => {
  if (process.defaultApp && process.argv[1]) app.setAsDefaultProtocolClient('spartan', process.execPath, [path.resolve(process.argv[1])]);
  else app.setAsDefaultProtocolClient('spartan');
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label: 'Spartan Gaming', submenu: [{role: 'about'}, {type: 'separator'}, {role: 'quit'}]}, {label: 'View', submenu: [{role: 'togglefullscreen'}, {role: 'reload'}, {role: 'toggledevtools'}]}]));
  ipcMain.handle('spartan:open-external', (_event, url) => { if (!isAllowedExternalUrl(url)) throw new Error('External links require HTTPS or a loopback HTTP URL.'); return shell.openExternal(new URL(url).href); });
  ipcMain.handle('spartan:open-provider', (_event, {url, title}) => createProviderView(url, title));
  ipcMain.handle('spartan:close-provider', closeProviderView);
  ipcMain.handle('spartan:set-quit-guard', (_event, enabled) => { if (typeof enabled !== 'boolean') throw new TypeError('quit guard must be boolean'); quitGuardEnabled = enabled; return quitGuardEnabled; });
  ipcMain.handle('spartan:set-session-active', (_event, active) => { if (typeof active !== 'boolean') throw new TypeError('session state must be boolean'); sessionActive = active; syncPowerSaveBlocker(); return sessionActive; });
  ipcMain.handle('spartan:apply-runtime-settings', (event, settings) => { if (event.sender !== windowRef.webContents) throw new Error('runtime settings may only be applied by the primary window'); runtimePolicy = normalizeElectronRuntimePolicy(settings); event.sender.setBackgroundThrottling(runtimePolicy.backgroundThrottling); syncPowerSaveBlocker(); if (runtimePolicy.backgroundApps) syncTray(); else destroyTray(); return runtimePolicy; });
  installPowerMonitoring();
  ipcMain.handle('spartan:toggle-fullscreen', () => { windowRef.setFullScreen(!windowRef.isFullScreen()); return windowRef.isFullScreen(); });
  await createMainWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) void createMainWindow(); });
});

app.on('window-all-closed', () => { if (shouldQuitWhenWindowsClose({platform: process.platform, backgroundApps: runtimePolicy.backgroundApps})) app.quit(); });
app.on('before-quit', event => {
  if (!quitting && quitGuardEnabled && (sessionActive || Boolean(providerView))) {
    event.preventDefault();
    void dialog.showMessageBox(windowRef, {type: 'question', buttons: ['Cancel', 'Quit'], defaultId: 0, cancelId: 0, title: 'Quit Spartan Gaming', message: 'A gaming session is active. Quit anyway?'}).then(result => { if (result.response === 1) { quitting = true; app.quit(); } });
    return;
  }
  void frontend?.close().catch(() => {});
});

app.on('will-quit', destroyTray);
app.on('will-quit', () => { if (powerBlockerId !== null) { try { powerSaveBlocker.stop(powerBlockerId); } catch {} powerBlockerId = null; powerBlockerType = null; } });
