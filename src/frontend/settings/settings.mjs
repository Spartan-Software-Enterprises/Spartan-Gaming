import '../pwa/register.mjs';
import {settingsCategories} from './settings-data.mjs';
import {createSettingsStore} from './profile.mjs';
import {resolveSettingsAction} from './actions.mjs';
import {applyRuntimeUiSettings} from './runtime-ui.mjs';
import {clearProviderSessionState} from '../providers/session-cleanup.mjs';
import {createHostConfigFromSettings, detectHostPlatform} from '../host/config.mjs';
import {renderSettingControl} from './control.mjs';
import {describeElectronRuntimeResult, resolveElectronRuntimeSettings} from './electron-runtime.mjs';
import {createControllerProfileStore} from '../input/profiles.mjs';
import {createActiveProfileStorage} from '../profiles/storage.mjs';

const settingsStore = createSettingsStore();
const controllerProfileStore = createControllerProfileStore({storage: createActiveProfileStorage({storage: globalThis.localStorage})});
const state = {...settingsStore.read()};
const requestedCategory = new URLSearchParams(globalThis.location?.search || '').get('category');
let activeCategory = settingsCategories.some((category) => category.id === requestedCategory) ? requestedCategory : 'general';
let query = '';

function saveState() {
  Object.assign(state, settingsStore.save(state));
  applyRuntimeUiSettings(document, state);
  const runtimeResult = globalThis.spartanElectron?.applyRuntimeSettings?.(resolveElectronRuntimeSettings(state));
  const status = document.querySelector('[data-save-status]');
  if (status) {
    status.textContent = 'Saved locally';
    void Promise.resolve(runtimeResult).then(result => { status.textContent = describeElectronRuntimeResult(result); }).catch(() => { status.textContent = 'Saved locally; desktop runtime update failed.'; });
    setTimeout(() => { status.textContent = 'All changes saved'; }, 1400);
  }
}

function renderedCategories() {
  const customProfiles = controllerProfileStore.list();
  if (!customProfiles.length) return settingsCategories;
  const customOptions = customProfiles.map(profile => profile.id);
  const optionLabels = Object.fromEntries(customProfiles.map(profile => [profile.id, `${profile.name} (custom)`]));
  return settingsCategories.map(category => category.id !== 'controllers' ? category : {...category, settings: category.settings.map(setting => setting.key !== 'controllers.defaultProfile' ? setting : {...setting, options: [...setting.options, ...customOptions.filter(id => !setting.options.includes(id))], optionLabels: {...setting.optionLabels, ...optionLabels}})});
}

function visibleCategories() {
  const categories = renderedCategories();
  if (!query) return categories;
  const needle = query.toLowerCase();
  return categories.map((category) => ({
    ...category,
    settings: category.settings.filter((setting) =>
      `${category.label} ${setting.label} ${setting.description}`.toLowerCase().includes(needle),
    ),
  })).filter((category) => category.settings.length > 0);
}

function renderNav() {
  const nav = document.querySelector('[data-settings-nav]');
  const categories = visibleCategories();
  nav.innerHTML = categories.map((category) => `
    <button class="nav-item ${activeCategory === category.id ? 'is-active' : ''}" data-category="${category.id}">
      <span class="nav-icon" aria-hidden="true">${category.icon}</span>
      <span>${category.label}</span>
      ${query ? `<small>${category.settings.length}</small>` : ''}
    </button>
  `).join('') || '<p class="empty-nav">No settings found.</p>';
  nav.querySelectorAll('[data-category]').forEach((button) => button.addEventListener('click', () => {
    activeCategory = button.dataset.category;
    render();
  }));
}

function renderContent() {
  const categories = renderedCategories();
  const category = categories.find((item) => item.id === activeCategory) ?? categories[0];
  const shown = query ? visibleCategories().find((item) => item.id === activeCategory) : category;
  const content = shown ?? category;
  document.querySelector('[data-settings-content]').innerHTML = `
    <div class="content-heading">
      <div><p class="eyebrow">Control center</p><h1>${content.label}</h1><p>${content.description}</p></div>
      <span class="save-status" data-save-status>All changes saved</span>
    </div>
    <div class="settings-sections">
      ${content.settings.length ? content.settings.map((setting) => `
        <section class="setting-row">
          <div class="setting-copy"><h2>${setting.label}</h2><p>${setting.description}</p></div>
          <div class="setting-control">${renderSettingControl(setting, state[setting.key])}</div>
        </section>
      `).join('') : '<div class="empty-state"><strong>No matching settings</strong><p>Try another search term or clear the filter.</p></div>'}
    </div>
  `;
  bindControls();
}

function bindControls() {
  document.querySelectorAll('[data-key]').forEach((control) => {
    const update = () => {
      const setting = renderedCategories().flatMap((category) => category.settings).find((item) => item.key === control.dataset.key);
      if (!setting) return;
      state[setting.key] = setting.type === 'toggle' ? !state[setting.key] : setting.type === 'range' ? Number(control.value) : control.value;
      if (setting.key === 'sync.activeProfile') { saveState(); window.location.reload(); return; }
      renderContent();
      saveState();
    };
    control.addEventListener(control.matches('input[type="range"]') ? 'input' : 'change', update);
    if (control.classList.contains('toggle')) control.addEventListener('click', update);
  });
  document.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', async () => {
    const action = resolveSettingsAction(button.dataset.action);
    if (!action) return;
    if (action.kind === 'reset') { Object.assign(state, settingsStore.reset()); render(); saveState(); return; }
    if (action.kind === 'navigate') { window.location.assign(action.href); return; }
    if (action.kind === 'external') { if (globalThis.spartanElectron?.openExternal) void globalThis.spartanElectron.openExternal(action.href).catch(error => { const status = document.querySelector('[data-save-status]'); if (status) status.textContent = error.message; }); else window.open(action.href, '_blank', 'noopener,noreferrer'); return; }
    if (action.kind === 'category') { activeCategory = action.category; query = ''; document.querySelector('[data-search]').value = ''; render(); return; }
    if (action.kind === 'export-settings') { downloadSettings(); return; }
    if (action.kind === 'export-host-config') { downloadHostConfig(); return; }
    if (action.kind === 'import-settings') { document.querySelector('[data-import-file]').click(); return; }
    if (action.kind === 'export-privacy') { downloadPrivacyData(); return; }
    if (action.kind === 'clear-provider-sessions') { const result = clearProviderSessionState(); const status = document.querySelector('[data-save-status]'); try { await globalThis.spartanElectron?.clearProviderLogins?.(); if (status) status.textContent = `Provider logins cleared${result.removed.length ? ` with ${result.removed.length} Spartan handoff${result.removed.length === 1 ? '' : 's'}` : ''}.`; } catch (error) { if (status) status.textContent = `Spartan handoffs cleared; provider login cleanup failed: ${error.message}`; } return; }
    const status = document.querySelector('[data-save-status]');
    if (status && action.kind === 'status') { status.textContent = action.message; return; }
  }));
}

function render() {
  renderNav();
  renderContent();
}

document.querySelector('[data-search]').addEventListener('input', (event) => {
  query = event.target.value.trim();
  const firstVisible = visibleCategories()[0];
  if (firstVisible && !visibleCategories().some((category) => category.id === activeCategory)) activeCategory = firstVisible.id;
  render();
});

function downloadSettings() {
  downloadJson('spartan-gaming-settings.json', settingsStore.export());
}

function downloadHostConfig() {
  const platform = detectHostPlatform({electronPlatform: globalThis.spartanElectron?.platform, navigatorRef: globalThis.navigator});
  downloadJson('spartan-host.json', JSON.stringify(createHostConfigFromSettings({platform, settings: state}), null, 2));
}

function downloadPrivacyData() {
  const privacy = Object.fromEntries(Object.entries(state).filter(([key]) => key.startsWith('privacy.')));
  downloadJson('spartan-gaming-privacy.json', JSON.stringify({version: 1, exportedAt: new Date().toISOString(), settings: privacy, note: 'Browser permission grants and provider credentials remain origin-scoped and are not included.'}, null, 2));
}

function downloadJson(filename, content) {
  const blob = new Blob([content], {type: 'application/json'});
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
    globalThis.spartanElectron?.applyRuntimeSettings?.(resolveElectronRuntimeSettings(state));
    render();
    document.querySelector('[data-save-status]').textContent = 'Imported and saved';
  } catch (error) {
    document.querySelector('[data-save-status]').textContent = error.message;
  }
  event.target.value = '';
});

render();
globalThis.spartanElectron?.applyRuntimeSettings?.(resolveElectronRuntimeSettings(state));
