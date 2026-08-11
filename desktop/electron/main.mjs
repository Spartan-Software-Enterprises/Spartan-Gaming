import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  nativeImage,
  dialog,
  globalShortcut,
  ipcMain,
  protocol,
  session,
  shell,
  WebContentsView,
  powerMonitor,
  powerSaveBlocker,
} from 'electron';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAllowedNavigation } from './security.mjs';
import {
  applyElectronPrivacyHeaders,
  normalizeElectronRuntimePolicy,
  resolvePermissionDecision,
  shouldQuitWhenWindowsClose,
} from './runtime-policy.mjs';
import { createTrayMenuTemplate, shouldCreateTray } from './tray-policy.mjs';
import { normalizePowerEvent, resolvePowerSaveBlockerType } from './power-runtime.mjs';
import { findSpartanDeepLink } from './deep-links.mjs';
import { createGlobalShortcutController } from './global-shortcut.mjs';
import {
  APP_ORIGIN,
  APP_PROTOCOL_PRIVILEGES,
  APP_SCHEME,
  createBundledAppProtocolHandler,
} from './app-protocol.mjs';
import { createApprovedNetworkPolicy } from './network-policy.mjs';
import { providerSessionPartitions, resolveProviderPartition } from './provider-session.mjs';

protocol.registerSchemesAsPrivileged([APP_PROTOCOL_PRIVILEGES]);
if (process.platform === 'linux')
  app.commandLine.appendSwitch('enable-features', 'GlobalShortcutsPortal');

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let windowRef;
let providerView;
const providerChildWindows = new Set();
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
let networkPolicy = createApprovedNetworkPolicy();

async function loadApprovedNetworkPolicy() {
  const [providerCatalog, gameCatalog] = await Promise.all([
    readFile(path.join(repositoryRoot, 'providers/catalog.json'), 'utf8').then(JSON.parse),
    readFile(path.join(repositoryRoot, 'games/catalog.json'), 'utf8').then(JSON.parse),
  ]);
  return createApprovedNetworkPolicy({
    providers: providerCatalog.providers,
    games: gameCatalog.games,
    downloadSources: ['https://github.com/Spartan-Software-Enterprises/Spartan-Gaming/releases'],
  });
}

function installPrivacyPolicy(electronSession, decisionScope = 'application') {
  if (!electronSession || privacySessions.has(electronSession)) return;
  privacySessions.add(electronSession);
  electronSession.webRequest.onBeforeSendHeaders((details, callback) =>
    callback({
      requestHeaders: applyElectronPrivacyHeaders(details.requestHeaders, details, runtimePolicy),
    }),
  );
  electronSession.setPermissionRequestHandler((webContents, permission, callback, details = {}) => {
    const requestingOrigin = (() => {
      try {
        return new URL(details.requestingUrl || webContents.getURL()).origin;
      } catch {
        return '';
      }
    })();
    const decisionKey = `${decisionScope}\n${requestingOrigin}\n${permission}`;
    const decision = resolvePermissionDecision(runtimePolicy, {
      storedDecision: permissionDecisions.get(decisionKey),
    });
    if (decision !== null) {
      callback(decision);
      return;
    }
    if (!windowRef || !requestingOrigin) {
      callback(false);
      return;
    }
    void dialog
      .showMessageBox(windowRef, {
        type: 'question',
        buttons: ['Block', 'Allow'],
        defaultId: 0,
        cancelId: 0,
        title: 'Permission request',
        message: `${requestingOrigin} requests ${permission} access.`,
      })
      .then((result) => {
        const allowed = result.response === 1;
        if (runtimePolicy.permissionPrompts === 'Ask per site')
          permissionDecisions.set(decisionKey, allowed);
        callback(allowed);
      })
      .catch(() => callback(false));
  });
}

function closeProviderView() {
  let closed = false;
  for (const childWindow of providerChildWindows) {
    if (!childWindow.isDestroyed()) childWindow.destroy();
    closed = true;
  }
  providerChildWindows.clear();
  if (!providerView) return closed;
  windowRef.contentView.removeChildView(providerView);
  providerView.webContents.close();
  providerView = null;
  windowRef.setTitle('Spartan Gaming');
  return true;
}

function createProviderView(url, title = 'Provider Player', sessionOptions = {}) {
  if (!networkPolicy.allowsProviderLaunch(url))
    throw new Error('Provider Player accepts only cataloged gaming-service URLs.');
  closeProviderView();
  const partition = resolveProviderPartition(sessionOptions);
  providerView = new WebContentsView({ webPreferences: providerWebPreferences(partition) });
  configureProviderWebContents(providerView.webContents, partition);
  providerView.webContents.on('enter-full-screen', () =>
    windowRef.webContents.send('spartan:fullscreen-changed', true),
  );
  providerView.webContents.on('leave-full-screen', () =>
    windowRef.webContents.send('spartan:fullscreen-changed', false),
  );
  windowRef.contentView.addChildView(providerView);
  resizeProvider();
  void providerView.webContents.loadURL(url);
  windowRef.setTitle(`Spartan Gaming — ${title}`);
}

function providerWebPreferences(partition) {
  return {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    partition,
  };
}

function configureProviderWebContents(contents, partition) {
  installPrivacyPolicy(contents.session, partition);
  contents.on('will-navigate', (event) => {
    if (!networkPolicy.allowsServiceUrl(event.url)) event.preventDefault();
  });
  contents.setWindowOpenHandler(({ url }) =>
    networkPolicy.allowsServiceUrl(url)
      ? {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 560,
            height: 760,
            autoHideMenuBar: true,
            backgroundColor: '#10151b',
            webPreferences: providerWebPreferences(partition),
          },
        }
      : { action: 'deny' },
  );
  contents.on('did-create-window', (childWindow) => {
    providerChildWindows.add(childWindow);
    childWindow.once('closed', () => providerChildWindows.delete(childWindow));
    configureProviderWebContents(childWindow.webContents, partition);
  });
}

function resizeProvider() {
  if (!providerView || !windowRef) return;
  const { width, height } = windowRef.getContentBounds();
  providerView.setBounds({ x: 0, y: 0, width, height });
}

function showMainWindow() {
  if (!windowRef) return;
  windowRef.show();
  windowRef.focus();
}

const shortcutController = createGlobalShortcutController({
  registry: globalShortcut,
  onActivate: showMainWindow,
});

function deliverDeepLink(link) {
  if (!link) return;
  if (!windowRef?.webContents || windowRef.webContents.isLoading()) {
    pendingDeepLink = link;
    return;
  }
  windowRef.webContents.send('spartan:deep-link', link);
}

function createTrayIcon() {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#10151b"/><path d="M8 24 16 7l8 17-8-4-8 4Z" fill="#50e1d1"/></svg>';
  return nativeImage.createFromDataURL(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  );
}

function destroyTray() {
  trayRef?.destroy();
  trayRef = null;
}

function syncPowerSaveBlocker() {
  const desired = resolvePowerSaveBlockerType({
    active: sessionActive,
    powerMode: runtimePolicy.powerMode,
  });
  if (desired === powerBlockerType && powerBlockerId !== null) return;
  if (powerBlockerId !== null) {
    try {
      powerSaveBlocker.stop(powerBlockerId);
    } catch {}
    powerBlockerId = null;
    powerBlockerType = null;
  }
  if (!desired) return;
  try {
    powerBlockerId = powerSaveBlocker.start(desired);
    powerBlockerType = desired;
  } catch {
    powerBlockerId = null;
    powerBlockerType = null;
  }
}

function broadcastPowerEvent(type, details = {}) {
  windowRef?.webContents.send('spartan:power-event', normalizePowerEvent(type, details));
}

function installPowerMonitoring() {
  for (const event of [
    'suspend',
    'resume',
    'on-battery',
    'on-ac',
    'shutdown',
    'lock-screen',
    'unlock-screen',
  ])
    powerMonitor.on(event, () => broadcastPowerEvent(event));
  powerMonitor.on('thermal-state-change', (_event, details) =>
    broadcastPowerEvent('thermal-state-change', details),
  );
  powerMonitor.on('speed-limit-change', (_event, details) =>
    broadcastPowerEvent('speed-limit-change', details),
  );
}

function syncTray() {
  if (!shouldCreateTray(runtimePolicy) || trayRef) return;
  trayRef = new Tray(createTrayIcon());
  trayRef.setToolTip('Spartan Gaming');
  trayRef.setContextMenu(
    Menu.buildFromTemplate(
      createTrayMenuTemplate({ onShow: showMainWindow, onQuit: () => app.quit() }),
    ),
  );
  trayRef.on('click', showMainWindow);
}

async function createMainWindow() {
  windowRef = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: 'Spartan Gaming',
    backgroundColor: '#10151b',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(repositoryRoot, 'desktop/electron/preload.mjs'),
    },
  });
  installPrivacyPolicy(windowRef.webContents.session);
  windowRef.on('resize', resizeProvider);
  windowRef.webContents.on('will-navigate', (event) => {
    if (!isAllowedNavigation(event.url, { appOrigin: APP_ORIGIN })) event.preventDefault();
  });
  windowRef.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  windowRef.webContents.on('before-input-event', (_event, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape') closeProviderView();
  });
  await windowRef.loadURL(`${APP_ORIGIN}/dashboard/?startup=1`);
  deliverDeepLink(pendingDeepLink);
  pendingDeepLink = null;
}

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    showMainWindow();
    deliverDeepLink(findSpartanDeepLink(commandLine));
  });
  app.on('open-url', (event, value) => {
    event.preventDefault();
    showMainWindow();
    deliverDeepLink(findSpartanDeepLink([value]));
  });
}

if (hasSingleInstanceLock)
  app.whenReady().then(async () => {
    await protocol.handle(
      APP_SCHEME,
      createBundledAppProtocolHandler({
        frontendRoot: path.join(repositoryRoot, 'src/frontend'),
        publicRoot: repositoryRoot,
      }),
    );
    networkPolicy = await loadApprovedNetworkPolicy();
    if (process.defaultApp && process.argv[1])
      app.setAsDefaultProtocolClient('spartan', process.execPath, [path.resolve(process.argv[1])]);
    else app.setAsDefaultProtocolClient('spartan');
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: 'Spartan Gaming',
          submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }],
        },
        {
          label: 'View',
          submenu: [{ role: 'togglefullscreen' }, { role: 'reload' }, { role: 'toggledevtools' }],
        },
      ]),
    );
    ipcMain.handle('spartan:open-external', (_event, url) => {
      if (!networkPolicy.allowsExternalUrl(url))
        throw new Error(
          'External links are limited to cataloged gaming services and approved download sources.',
        );
      return shell.openExternal(new URL(url).href);
    });
    ipcMain.handle('spartan:open-provider', (event, request = {}) => {
      if (event.sender !== windowRef.webContents)
        throw new Error('provider views may only be opened by the primary window');
      const { url, title, sessionOptions } = request;
      return createProviderView(url, title, sessionOptions);
    });
    ipcMain.handle('spartan:close-provider', closeProviderView);
    ipcMain.handle('spartan:clear-provider-logins', async (event) => {
      if (event.sender !== windowRef.webContents)
        throw new Error('provider logins may only be cleared by the primary window');
      closeProviderView();
      await Promise.all(
        providerSessionPartitions().map(async (partition) => {
          const providerSession = session.fromPartition(partition);
          await providerSession.clearStorageData({
            storages: [
              'cookies',
              'filesystem',
              'indexdb',
              'localstorage',
              'serviceworkers',
              'cachestorage',
            ],
          });
          await providerSession.clearCache();
          await providerSession.clearAuthCache();
        }),
      );
      permissionDecisions.clear();
      return Object.freeze({ cleared: true });
    });
    ipcMain.handle('spartan:set-quit-guard', (_event, enabled) => {
      if (typeof enabled !== 'boolean') throw new TypeError('quit guard must be boolean');
      quitGuardEnabled = enabled;
      return quitGuardEnabled;
    });
    ipcMain.handle('spartan:set-session-active', (_event, active) => {
      if (typeof active !== 'boolean') throw new TypeError('session state must be boolean');
      sessionActive = active;
      syncPowerSaveBlocker();
      return sessionActive;
    });
    ipcMain.handle('spartan:apply-runtime-settings', (event, settings) => {
      if (event.sender !== windowRef.webContents)
        throw new Error('runtime settings may only be applied by the primary window');
      runtimePolicy = normalizeElectronRuntimePolicy(settings);
      event.sender.setBackgroundThrottling(runtimePolicy.backgroundThrottling);
      syncPowerSaveBlocker();
      if (runtimePolicy.backgroundApps) syncTray();
      else destroyTray();
      return Object.freeze({
        ...runtimePolicy,
        globalShortcutStatus: shortcutController.sync(runtimePolicy.globalShortcut),
      });
    });
    installPowerMonitoring();
    ipcMain.handle('spartan:toggle-fullscreen', () => {
      windowRef.setFullScreen(!windowRef.isFullScreen());
      return windowRef.isFullScreen();
    });
    await createMainWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) void createMainWindow();
    });
  });

app.on('window-all-closed', () => {
  if (
    shouldQuitWhenWindowsClose({
      platform: process.platform,
      backgroundApps: runtimePolicy.backgroundApps,
    })
  )
    app.quit();
});
app.on('before-quit', (event) => {
  if (!quitting && quitGuardEnabled && (sessionActive || Boolean(providerView))) {
    event.preventDefault();
    void dialog
      .showMessageBox(windowRef, {
        type: 'question',
        buttons: ['Cancel', 'Quit'],
        defaultId: 0,
        cancelId: 0,
        title: 'Quit Spartan Gaming',
        message: 'A gaming session is active. Quit anyway?',
      })
      .then((result) => {
        if (result.response === 1) {
          quitting = true;
          app.quit();
        }
      });
    return;
  }
});

app.on('will-quit', destroyTray);
app.on('will-quit', () => shortcutController.dispose());
app.on('will-quit', () => {
  if (powerBlockerId !== null) {
    try {
      powerSaveBlocker.stop(powerBlockerId);
    } catch {}
    powerBlockerId = null;
    powerBlockerType = null;
  }
});
