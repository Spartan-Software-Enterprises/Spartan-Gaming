import '../pwa/register.mjs';
import {settingsCategories} from './settings-data.mjs';
import {createSettingsStore} from './profile.mjs';
import {resolveSettingsAction} from './actions.mjs';
import {applyRuntimeUiSettings} from './runtime-ui.mjs';
import {clearProviderSessionState} from '../providers/session-cleanup.mjs';
import {createHostConfigFromSettings, detectHostPlatform} from '../host/config.mjs';
import {renderSettingControl} from './control.mjs';

const settingsStore = createSettingsStore();
const state = {...settingsStore.read()};
const requestedCategory = new URLSearchParams(globalThis.location?.search || '').get('category');
let activeCategory = settingsCategories.some((category) => category.id === requestedCategory) ? requestedCategory : 'general';
let query = '';

function saveState() {
  Object.assign(state, settingsStore.save(state));
  applyRuntimeUiSettings(document, state);
  globalThis.spartanElectron?.applyRuntimeSettings?.({backgroundApps: state['general.backgroundApps'] === true, backgroundThrottling: state['performance.backgroundThrottling'] !== false, powerMode: state['performance.powerMode'], doNotTrack: state['privacy.doNotTrack'] === true, blockThirdPartyCookies: state['privacy.blockThirdPartyCookies'] === true, permissionPrompts: state['privacy.permissionPrompts']});
  const status = document.querySelector('[data-save-status]');
  if (status) {
    status.textContent = 'Saved locally';
    setTimeout(() => { status.textContent = 'All changes saved'; }, 1400);
  }
}

function visibleCategories() {
  if (!query) return settingsCategories;
  const needle = query.toLowerCase();
  return settingsCategories.map((category) => ({
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
  const category = settingsCategories.find((item) => item.id === activeCategory) ?? settingsCategories[0];
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
      const setting = settingsCategories.flatMap((category) => category.settings).find((item) => item.key === control.dataset.key);
      if (!setting) return;
      state[setting.key] = setting.type === 'toggle' ? !state[setting.key] : setting.type === 'range' ? Number(control.value) : control.value;
      saveState();
      if (setting.key === 'sync.activeProfile') { window.location.reload(); return; }
      renderContent();
    };
    control.addEventListener(control.matches('input[type="range"]') ? 'input' : 'change', update);
    if (control.classList.contains('toggle')) control.addEventListener('click', update);
  });
  document.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => {
    const action = resolveSettingsAction(button.dataset.action);
    if (!action) return;
    if (action.kind === 'reset') { Object.assign(state, settingsStore.reset()); saveState(); render(); return; }
    if (action.kind === 'navigate') { window.location.assign(action.href); return; }
    if (action.kind === 'external') { window.open(action.href, '_blank', 'noopener,noreferrer'); return; }
    if (action.kind === 'category') { activeCategory = action.category; query = ''; document.querySelector('[data-search]').value = ''; render(); return; }
    if (action.kind === 'export-settings') { downloadSettings(); return; }
    if (action.kind === 'export-host-config') { downloadHostConfig(); return; }
    if (action.kind === 'import-settings') { document.querySelector('[data-import-file]').click(); return; }
    if (action.kind === 'export-privacy') { downloadPrivacyData(); return; }
    if (action.kind === 'clear-provider-sessions') { const result = clearProviderSessionState(); const status = document.querySelector('[data-save-status]'); if (status) status.textContent = result.removed.length ? `Cleared ${result.removed.length} Spartan handoff${result.removed.length === 1 ? '' : 's'}; sign out on official services separately.` : 'No Spartan provider handoffs were present; sign out on official services separately.'; return; }
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
    render();
    document.querySelector('[data-save-status]').textContent = 'Imported and saved';
  } catch (error) {
    document.querySelector('[data-save-status]').textContent = error.message;
  }
  event.target.value = '';
});

render();
globalThis.spartanElectron?.applyRuntimeSettings?.({backgroundApps: state['general.backgroundApps'] === true, backgroundThrottling: state['performance.backgroundThrottling'] !== false, powerMode: state['performance.powerMode'], doNotTrack: state['privacy.doNotTrack'] === true, blockThirdPartyCookies: state['privacy.blockThirdPartyCookies'] === true, permissionPrompts: state['privacy.permissionPrompts']});
