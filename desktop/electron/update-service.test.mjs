import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import {
  createElectronUpdateController,
  normalizeElectronUpdatePolicy,
  normalizeElectronUpdateStatus,
} from './update-service.mjs';

class FakeUpdater extends EventEmitter {
  checks = 0;
  installs = [];

  async checkForUpdates() {
    this.checks += 1;
    this.emit('checking-for-update');
    this.emit('update-available', { version: '1.2.0', releaseName: 'ignored' });
    this.emit('download-progress', { percent: 42.4, transferred: 9, total: 20 });
    return { updateInfo: { version: '1.2.0' } };
  }

  quitAndInstall(...args) {
    this.installs.push(args);
  }
}

test('Electron update policy supports stable beta and alpha channels with safe defaults', () => {
  assert.deepEqual(normalizeElectronUpdatePolicy(), {
    channelLabel: 'Stable',
    channel: 'latest',
    autoUpdate: true,
    notifyRestart: true,
  });
  assert.deepEqual(
    normalizeElectronUpdatePolicy({
      updateChannel: 'Beta',
      autoUpdate: false,
      notifyRestart: false,
    }),
    {
      channelLabel: 'Beta',
      channel: 'beta',
      autoUpdate: false,
      notifyRestart: false,
    },
  );
  assert.equal(normalizeElectronUpdatePolicy({ updateChannel: 'Nightly' }).channel, 'latest');
});

test('Electron update status exposes only bounded progress and version fields', () => {
  assert.deepEqual(normalizeElectronUpdateStatus('downloading', { percent: 42.6 }), {
    status: 'downloading',
    percent: 43,
  });
  assert.deepEqual(
    normalizeElectronUpdateStatus('update-available', {
      version: '1.2.3-beta.1',
      url: 'https://secret.example/update',
    }),
    { status: 'update-available', version: '1.2.3-beta.1' },
  );
  assert.deepEqual(normalizeElectronUpdateStatus('unknown', { version: '../../bad' }), {
    status: 'unavailable',
  });
});

test('development builds and disabled automatic checks never contact the updater', async () => {
  const updater = new FakeUpdater();
  const development = createElectronUpdateController({ updater });
  assert.deepEqual(await development.check({ manual: true }), { status: 'development-build' });
  const packaged = createElectronUpdateController({ isPackaged: true, updater });
  packaged.configure({ autoUpdate: false });
  assert.deepEqual(await packaged.check(), { status: 'disabled' });
  assert.equal(updater.checks, 0);
});

test('manual checks configure the selected channel and publish bounded progress', async () => {
  const updater = new FakeUpdater();
  const statuses = [];
  const controller = createElectronUpdateController({
    isPackaged: true,
    updater,
    onStatus: (status) => statuses.push(status),
  });
  controller.configure({ updateChannel: 'Alpha', autoUpdate: false });
  assert.deepEqual(await controller.check({ manual: true }), {
    status: 'downloading',
    percent: 42,
  });
  assert.equal(updater.channel, 'alpha');
  assert.equal(updater.allowPrerelease, true);
  assert.equal(updater.autoDownload, true);
  assert.equal(updater.logger, null);
  assert.deepEqual(
    statuses.map(({ status }) => status),
    ['checking', 'checking', 'update-available', 'downloading'],
  );
});

test('late updater attachment preserves the selected policy', () => {
  const controller = createElectronUpdateController({ isPackaged: true });
  controller.configure({ updateChannel: 'Beta', autoUpdate: false });
  const updater = new FakeUpdater();
  assert.equal(controller.attach(updater), true);
  assert.equal(updater.channel, 'beta');
  assert.equal(updater.allowPrerelease, true);
  assert.equal(updater.autoDownload, true);
});

test('downloaded updates prompt when configured and install only after confirmation', async () => {
  const updater = new FakeUpdater();
  let installs = 0;
  const controller = createElectronUpdateController({
    isPackaged: true,
    updater,
    dialog: { showMessageBox: async () => ({ response: 0 }) },
    onInstall: () => {
      installs += 1;
    },
  });
  updater.emit('update-downloaded', { version: '1.2.0' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(installs, 1);
  assert.deepEqual(updater.installs, [[false, true]]);
  controller.configure({ notifyRestart: false });
  updater.emit('update-downloaded', { version: '1.2.1' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(installs, 1);
});
