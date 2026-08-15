import '../pwa/register.mjs';
import { settingsCategories } from './settings-data.mjs';
import { createSettingsStore } from './profile.mjs';
import { resolveSettingsAction } from './actions.mjs';
import { applyRuntimeUiSettings } from './runtime-ui.mjs';
import { clearProviderSessionState, clearAutoLoginStorage } from '../providers/session-cleanup.mjs';
import { createHostConfigFromSettings, detectHostPlatform } from '../host/config.mjs';
import { renderSettingControl } from './control.mjs';
import {
  describeElectronRuntimeResult,
  describeElectronUpdateStatus,
  resolveElectronRuntimeSettings,
} from './electron-runtime.mjs';
import { createControllerProfileStore } from '../input/profiles.mjs';
import { createActiveProfileStorage } from '../profiles/storage.mjs';

const settingsStore = createSettingsStore();
const controllerProfileStore = createControllerProfileStore({
  storage: createActiveProfileStorage({ storage: globalThis.localStorage }),
});
const state = { ...settingsStore.read() };
const requestedCategory = new URLSearchParams(globalThis.location?.search || '').get('category');
let activeCategory = settingsCategories.some((category) => category.id === requestedCategory)
  ? requestedCategory
  : 'general';
let query = '';
let runtimeSaveSequence = 0;
let currentUpdateStatus = null;

function displayUpdateStatus(updateStatus) {
  currentUpdateStatus = updateStatus;
  if (activeCategory !== 'updates') return;
  const status = document.querySelector('[data-save-status]');
  if (status) status.textContent = describeElectronUpdateStatus(updateStatus);
}

function updateStatusOwnsSaveArea() {
  return activeCategory === 'updates' && currentUpdateStatus !== null;
}

function saveState() {
  Object.assign(state, settingsStore.save(state));
  applyRuntimeUiSettings(document, state);
  const runtimeSettings = resolveElectronRuntimeSettings(state);
  const runtimeResult = globalThis.spartanElectron?.applyRuntimeSettings?.(
    JSON.stringify(runtimeSettings),
  );
  const saveSequence = ++runtimeSaveSequence;
  const status = document.querySelector('[data-save-status]');
  if (status && !updateStatusOwnsSaveArea()) {
    status.textContent = 'Saved locally';
    void Promise.resolve(runtimeResult)
      .then((serializedResult) => {
        if (saveSequence !== runtimeSaveSequence || updateStatusOwnsSaveArea()) return;
        const result =
          typeof serializedResult === 'string' ? JSON.parse(serializedResult) : serializedResult;
        const startupPolicy = result?.startupPolicy;
        document.documentElement.dataset.spartanHardwareAcceleration =
          startupPolicy?.hardwareAcceleration === false ? 'disabled' : 'enabled';
        document.documentElement.dataset.spartanRestartRequired = startupPolicy?.requiresRestart
          ? 'true'
          : 'false';
        status.textContent = describeElectronRuntimeResult({ ...result, startupPolicy });
      })
      .catch(() => {
        if (saveSequence !== runtimeSaveSequence || updateStatusOwnsSaveArea()) return;
        status.textContent = 'Saved locally; desktop runtime update failed.';
      });
    setTimeout(() => {
      if (updateStatusOwnsSaveArea()) return;
      status.textContent = 'All changes saved';
    }, 1400);
  }
}

function renderedCategories() {
  const customProfiles = controllerProfileStore.list();
  if (!customProfiles.length) return settingsCategories;
  const customOptions = customProfiles.map((profile) => profile.id);
  const optionLabels = Object.fromEntries(
    customProfiles.map((profile) => [profile.id, `${profile.name} (custom)`]),
  );
  return settingsCategories.map((category) =>
    category.id !== 'controllers'
      ? category
      : {
          ...category,
          settings: category.settings.map((setting) =>
            setting.key !== 'controllers.defaultProfile'
              ? setting
              : {
                  ...setting,
                  options: [
                    ...setting.options,
                    ...customOptions.filter((id) => !setting.options.includes(id)),
                  ],
                  optionLabels: { ...setting.optionLabels, ...optionLabels },
                },
          ),
        },
  );
}

function visibleCategories() {
  const categories = renderedCategories();
  if (!query) return categories;
  const needle = query.toLowerCase();
  return categories
    .map((category) => ({
      ...category,
      settings: category.settings.filter((setting) =>
        `${category.label} ${setting.label} ${setting.description}`.toLowerCase().includes(needle),
      ),
    }))
    .filter((category) => category.settings.length > 0);
}

function scrollSettingsToTop() {
  globalThis.scrollTo?.(0, 0);
  document.querySelector('.main')?.scrollTo?.(0, 0);
}

function renderNav() {
  const nav = document.querySelector('[data-settings-nav]');
  const categories = visibleCategories();
  nav.innerHTML =
    categories
      .map(
        (category) => `
    <button class="nav-item ${activeCategory === category.id ? 'is-active' : ''}" data-category="${category.id}">
      <span class="nav-icon" aria-hidden="true">${category.icon}</span>
      <span>${category.label}</span>
      ${query ? `<small>${category.settings.length}</small>` : ''}
    </button>
  `,
      )
      .join('') || '<p class="empty-nav">No settings found.</p>';
  nav.querySelectorAll('[data-category]').forEach((button) =>
    button.addEventListener('click', () => {
      activeCategory = button.dataset.category;
      render();
      scrollSettingsToTop();
    }),
  );
}

function renderContent() {
  const previousStatus = document.querySelector('[data-save-status]')?.textContent;
  const categories = renderedCategories();
  const category = categories.find((item) => item.id === activeCategory) ?? categories[0];
  const shown = query ? visibleCategories().find((item) => item.id === activeCategory) : category;
  const content = shown ?? category;
  document.querySelector('[data-settings-content]').innerHTML = `
    <div class="content-heading">
      <div><p class="eyebrow">Control center</p><h1>${content.label}</h1><p>${content.description}</p></div>
      <span class="save-status" data-save-status>${previousStatus || 'All changes saved'}</span>
    </div>
    <div class="settings-sections">
      ${
        content.settings.length
          ? content.settings
              .map(
                (setting) => `
        <section class="setting-row">
          <div class="setting-copy"><h2>${setting.label}</h2><p>${setting.description}</p></div>
          <div class="setting-control">${renderSettingControl(setting, state[setting.key])}</div>
        </section>
      `,
              )
              .join('')
          : '<div class="empty-state"><strong>No matching settings</strong><p>Try another search term or clear the filter.</p></div>'
      }
    </div>
  `;
  if (activeCategory === 'updates' && currentUpdateStatus)
    document.querySelector('[data-save-status]').textContent =
      describeElectronUpdateStatus(currentUpdateStatus);
  bindControls();
}

function bindControls() {
  document.querySelectorAll('[data-key]').forEach((control) => {
    const update = () => {
      const setting = renderedCategories()
        .flatMap((category) => category.settings)
        .find((item) => item.key === control.dataset.key);
      if (!setting) return;
      state[setting.key] =
        setting.type === 'toggle'
          ? !state[setting.key]
          : setting.type === 'range'
            ? Number(control.value)
            : control.value;
      if (setting.key === 'sync.activeProfile') {
        saveState();
        window.location.reload();
        return;
      }
      if (control.matches('input[type="range"]')) {
        const output = control.parentElement?.querySelector('output');
        if (output) output.textContent = `${state[setting.key]}${setting.unit || ''}`;
        saveState();
        return;
      }
      renderContent();
      saveState();
    };
    const eventName = control.classList.contains('toggle')
      ? 'click'
      : control.matches('input[type="range"]')
        ? 'input'
        : 'change';
    control.addEventListener(eventName, update);
  });
  document.querySelectorAll('[data-action]').forEach((button) =>
    button.addEventListener('click', async () => {
      const action = resolveSettingsAction(button.dataset.action);
      if (!action) return;
      if (action.kind === 'reset') {
        Object.assign(state, settingsStore.reset());
        render();
        saveState();
        return;
      }
      if (action.kind === 'navigate') {
        window.location.assign(action.href);
        return;
      }
      if (action.kind === 'external') {
        if (globalThis.spartanElectron?.openExternal)
          void globalThis.spartanElectron.openExternal(action.href).catch((error) => {
            const status = document.querySelector('[data-save-status]');
            if (status) status.textContent = error.message;
          });
        else window.open(action.href, '_blank', 'noopener,noreferrer');
        return;
      }
      if (action.kind === 'category') {
        activeCategory = action.category;
        query = '';
        document.querySelector('[data-search]').value = '';
        render();
        scrollSettingsToTop();
        return;
      }
      if (action.kind === 'export-settings') {
        downloadSettings();
        return;
      }
      if (action.kind === 'export-host-config') {
        downloadHostConfig();
        return;
      }
      if (action.kind === 'import-settings') {
        document.querySelector('[data-import-file]').click();
        return;
      }
      if (action.kind === 'export-privacy') {
        downloadPrivacyData();
        return;
      }
      if (action.kind === 'clear-provider-sessions') {
        const result = clearProviderSessionState();
        const autoLogin = clearAutoLoginStorage();
        const total = result.removed.length + autoLogin.removed.length;
        const status = document.querySelector('[data-save-status]');
        try {
          await globalThis.spartanElectron?.clearProviderLogins?.();
          if (status)
            status.textContent = `Provider logins cleared${total ? ` with ${total} Spartan handoff${total === 1 ? '' : 's'}` : ''}.`;
        } catch (error) {
          if (status)
            status.textContent = `Spartan handoffs cleared; provider login cleanup failed: ${error.message}`;
        }
        return;
      }
      if (action.kind === 'clear-credentials') {
        for (const key of [
          'accounts.defaultLogin',
          'accounts.syncApiKey',
          'accounts.hostApiKey',
          'accounts.providerClientId',
          'accounts.providerApiKey',
        ])
          state[key] = '';
        saveState();
        renderContent();
        return;
      }
      if (action.kind === 'export-diagnostics') {
        const status = document.querySelector('[data-save-status]');
        if (!globalThis.spartanElectron?.exportDiagnostics) {
          window.location.assign('../diagnostics/index.html');
          return;
        }
        try {
          const result = await globalThis.spartanElectron.exportDiagnostics();
          if (status)
            status.textContent = result?.canceled
              ? 'Diagnostics export canceled.'
              : `Exported ${result?.entryCount ?? 0} local diagnostic entries.`;
        } catch (error) {
          if (status) status.textContent = `Diagnostics export failed: ${error.message}`;
        }
        return;
      }
      if (action.kind === 'clear-diagnostics') {
        const status = document.querySelector('[data-save-status]');
        if (!globalThis.spartanElectron?.clearDiagnostics) {
          if (status) status.textContent = 'No Electron diagnostic log is available in this build.';
          return;
        }
        try {
          await globalThis.spartanElectron.clearDiagnostics();
          if (status) status.textContent = 'Local Electron diagnostics cleared.';
        } catch (error) {
          if (status) status.textContent = `Diagnostics cleanup failed: ${error.message}`;
        }
        return;
      }
      if (action.kind === 'developer-tools') {
        const status = document.querySelector('[data-save-status]');
        if (!globalThis.spartanElectron?.toggleDeveloperTools) {
          if (status)
            status.textContent = 'Developer tools are available only in the Electron desktop app.';
          return;
        }
        try {
          const result = await globalThis.spartanElectron.toggleDeveloperTools();
          if (status)
            status.textContent = result?.opened
              ? 'Developer tools opened for the Spartan Gaming application.'
              : result?.reason === 'disabled'
                ? 'Enable developer mode before opening developer tools.'
                : 'Developer tools closed.';
        } catch (error) {
          if (status) status.textContent = `Developer tools failed: ${error.message}`;
        }
        return;
      }
      if (action.kind === 'update-check') {
        const status = document.querySelector('[data-save-status]');
        if (globalThis.spartanElectron?.checkForUpdates) {
          displayUpdateStatus({ status: 'checking' });
          try {
            const result = await globalThis.spartanElectron.checkForUpdates();
            displayUpdateStatus(result);
          } catch {
            displayUpdateStatus({ status: 'unavailable' });
          }
          return;
        }
        if (globalThis.SpartanAndroid) {
          if (status) status.textContent = 'Checking GitHub releases…';
          try {
            const response = await fetch(
              'https://api.github.com/repos/Spartan-Software-Enterprises/Spartan-Gaming/releases?per_page=1',
              { headers: { Accept: 'application/vnd.github+json' } },
            );
            if (!response.ok) throw new Error(`release check failed: ${response.status}`);
            const release = await response.json();
            if (status)
              status.textContent = `Latest GitHub release: ${release.tag_name || 'available'}. Android checks automatically at startup.`;
          } catch {
            if (status) status.textContent = 'GitHub release checks are currently unavailable.';
          }
          return;
        }
        if (status) status.textContent = 'GitHub release checks are available in the app.';
      }
      const status = document.querySelector('[data-save-status]');
      if (status && action.kind === 'status') {
        status.textContent = action.message;
        return;
      }
    }),
  );
}

function render() {
  renderNav();
  renderContent();
}

document.querySelector('[data-search]').addEventListener('input', (event) => {
  query = event.target.value.trim();
  const firstVisible = visibleCategories()[0];
  if (firstVisible && !visibleCategories().some((category) => category.id === activeCategory))
    activeCategory = firstVisible.id;
  render();
});

function downloadSettings() {
  downloadJson('spartan-gaming-settings.json', settingsStore.export());
}

function downloadHostConfig() {
  const platform = detectHostPlatform({
    electronPlatform: globalThis.spartanElectron?.platform,
    navigatorRef: globalThis.navigator,
  });
  downloadJson(
    'spartan-host.json',
    JSON.stringify(createHostConfigFromSettings({ platform, settings: state }), null, 2),
  );
}

function downloadPrivacyData() {
  const privacy = Object.fromEntries(
    Object.entries(state).filter(([key]) => key.startsWith('privacy.')),
  );
  downloadJson(
    'spartan-gaming-privacy.json',
    JSON.stringify(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        settings: privacy,
        note: 'Browser permission grants and provider credentials remain origin-scoped and are not included.',
      },
      null,
      2,
    ),
  );
}

function downloadJson(filename, content) {
  const blob = new Blob([content], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

document.querySelector('[data-export]').addEventListener('click', downloadSettings);
document.querySelector('[data-import-file]').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    Object.assign(state, settingsStore.import(await file.text()));
    applyRuntimeUiSettings(document, state);
    const runtimeSettings = resolveElectronRuntimeSettings(state);
    globalThis.spartanElectron?.applyRuntimeSettings?.(JSON.stringify(runtimeSettings));
    render();
    document.querySelector('[data-save-status]').textContent = 'Imported and saved';
  } catch (error) {
    document.querySelector('[data-save-status]').textContent = error.message;
  }
  event.target.value = '';
});

render();
const initialRuntimeSettings = resolveElectronRuntimeSettings(state);
globalThis.spartanElectron?.applyRuntimeSettings?.(JSON.stringify(initialRuntimeSettings));
let receivedUpdateStatus = false;
globalThis.spartanElectron?.onUpdateStatus?.((updateStatus) => {
  receivedUpdateStatus = true;
  displayUpdateStatus(updateStatus);
});
void globalThis.spartanElectron
  ?.getUpdateStatus?.()
  .then((updateStatus) => {
    if (receivedUpdateStatus) return;
    displayUpdateStatus(updateStatus);
  })
  .catch(() => {});
