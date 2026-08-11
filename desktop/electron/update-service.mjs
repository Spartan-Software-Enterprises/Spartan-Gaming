const UPDATE_CHANNELS = Object.freeze({
  Stable: 'latest',
  Beta: 'beta',
  Alpha: 'alpha',
});

function boundedVersion(value) {
  const version = typeof value === 'string' ? value.trim() : '';
  return /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/.test(version) ? version : null;
}

function boundedPercent(value) {
  const percent = Number(value);
  return Number.isFinite(percent) ? Math.min(100, Math.max(0, Math.round(percent))) : null;
}

export function normalizeElectronUpdatePolicy(settings = {}) {
  const channelLabel = Object.hasOwn(UPDATE_CHANNELS, settings?.updateChannel)
    ? settings.updateChannel
    : 'Stable';
  return Object.freeze({
    channelLabel,
    channel: UPDATE_CHANNELS[channelLabel],
    autoUpdate: settings?.autoUpdate !== false,
    notifyRestart: settings?.notifyRestart !== false,
  });
}

export function normalizeElectronUpdateStatus(status, details = {}) {
  const supported = new Set([
    'idle',
    'disabled',
    'development-build',
    'checking',
    'update-available',
    'downloading',
    'downloaded',
    'up-to-date',
    'unavailable',
  ]);
  const normalizedStatus = supported.has(status) ? status : 'unavailable';
  const result = { status: normalizedStatus };
  const version = boundedVersion(details?.version);
  const percent = boundedPercent(details?.percent);
  if (version) result.version = version;
  if (percent !== null && normalizedStatus === 'downloading') result.percent = percent;
  return Object.freeze(result);
}

/**
 * Own the packaged Electron updater behind a bounded, testable main-process contract.
 * The injected updater is electron-updater's autoUpdater in production.
 */
export function createElectronUpdateController({
  isPackaged = false,
  updater: initialUpdater = null,
  dialog,
  getWindow = () => null,
  onStatus = () => {},
  onInstall = () => {},
} = {}) {
  let updater = null;
  let policy = normalizeElectronUpdatePolicy();
  let currentStatus = normalizeElectronUpdateStatus('idle');
  let checkPromise = null;

  const applyUpdaterPolicy = () => {
    if (!updater) return;
    updater.logger = null;
    updater.channel = policy.channel;
    updater.allowPrerelease = policy.channel !== 'latest';
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
  };

  const publish = (status, details) => {
    currentStatus = normalizeElectronUpdateStatus(status, details);
    onStatus(currentStatus);
    return currentStatus;
  };

  const showRestartPrompt = async () => {
    if (!policy.notifyRestart || !dialog?.showMessageBox || !updater) return;
    const options = {
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Spartan Gaming update ready',
      message: 'A verified Spartan Gaming update has downloaded.',
      detail: 'Restart now to apply it, or choose Later to install when the application exits.',
    };
    const owner = getWindow();
    const result = owner
      ? await dialog.showMessageBox(owner, options)
      : await dialog.showMessageBox(options);
    if (result?.response === 0) {
      onInstall();
      updater.quitAndInstall(false, true);
    }
  };

  const attach = (nextUpdater) => {
    if (!nextUpdater || updater === nextUpdater) return Boolean(updater);
    updater = nextUpdater;
    applyUpdaterPolicy();
    updater.on('checking-for-update', () => publish('checking'));
    updater.on('update-available', (info) =>
      publish('update-available', { version: info?.version }),
    );
    updater.on('update-not-available', (info) => publish('up-to-date', { version: info?.version }));
    updater.on('download-progress', (progress) =>
      publish('downloading', { percent: progress?.percent }),
    );
    updater.on('update-downloaded', (info) => {
      publish('downloaded', { version: info?.version });
      void showRestartPrompt().catch(() => publish('downloaded', { version: info?.version }));
    });
    updater.on('error', () => publish('unavailable'));
    return true;
  };

  const configure = (settings = {}) => {
    policy = normalizeElectronUpdatePolicy(settings);
    applyUpdaterPolicy();
    return policy;
  };

  const check = ({ manual = false } = {}) => {
    if (!isPackaged) return Promise.resolve(publish('development-build'));
    if (!updater) return Promise.resolve(publish('unavailable'));
    if (!manual && !policy.autoUpdate) return Promise.resolve(publish('disabled'));
    if (checkPromise) return checkPromise;
    applyUpdaterPolicy();
    publish('checking');
    checkPromise = Promise.resolve(updater.checkForUpdates())
      .then(() => currentStatus)
      .catch(() => publish('unavailable'))
      .finally(() => {
        checkPromise = null;
      });
    return checkPromise;
  };

  attach(initialUpdater);
  configure(policy);
  return Object.freeze({
    attach,
    configure,
    check,
    get policy() {
      return policy;
    },
    get status() {
      return currentStatus;
    },
  });
}
