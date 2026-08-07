import '../pwa/register.mjs';
import {defaultSettings, settingsCategories} from './settings-data.mjs';

const storageKey = 'spartan-gaming.settings.v1';
const state = loadState();
const requestedCategory = new URLSearchParams(globalThis.location?.search || '').get('category');
let activeCategory = settingsCategories.some((category) => category.id === requestedCategory) ? requestedCategory : 'general';
let query = '';

function loadState() {
  try {
    return {...defaultSettings, ...JSON.parse(localStorage.getItem(storageKey) ?? '{}')};
  } catch {
    return {...defaultSettings};
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
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

function renderControl(setting) {
  const value = state[setting.key];
  if (setting.type === 'toggle') {
    return `<button class="toggle ${value ? 'is-on' : ''}" role="switch" aria-checked="${Boolean(value)}" data-key="${setting.key}"><span></span><b>${value ? 'On' : 'Off'}</b></button>`;
  }
  if (setting.type === 'select') {
    return `<select data-key="${setting.key}">${setting.options.map((option) => `<option ${option === value ? 'selected' : ''}>${option}</option>`).join('')}</select>`;
  }
  if (setting.type === 'range') {
    return `<div class="range-control"><input type="range" min="${setting.min}" max="${setting.max}" step="${setting.step}" value="${value}" data-key="${setting.key}"><output>${value}${setting.unit}</output></div>`;
  }
  if (setting.type === 'text') return `<input class="text-input" type="text" value="${value ?? ''}" placeholder="Not configured" data-key="${setting.key}">`;
  return `<button class="action-button" data-action="${setting.key}">${setting.actionLabel}</button>`;
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
          <div class="setting-control">${renderControl(setting)}</div>
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
      renderContent();
    };
    control.addEventListener(control.matches('input[type="range"]') ? 'input' : 'change', update);
    if (control.classList.contains('toggle')) control.addEventListener('click', update);
  });
  document.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => {
    if (button.dataset.action === 'general.reset') {
      Object.assign(state, defaultSettings);
      saveState();
      render();
      return;
    }
    if (button.dataset.action === 'controllers.manageProfiles') {
      window.location.assign('../input/profiles.html');
      return;
    }
    if (button.dataset.action === 'controllers.test') {
      window.location.assign('../input/inspector.html');
      return;
    }
    if (button.dataset.action === 'sync.manageProfiles') {
      window.location.assign('../workspaces/index.html');
      return;
    }
    if (button.dataset.action === 'providers.manageProfiles') {
      window.location.assign('../providers/index.html');
      return;
    }
    if (button.dataset.action === 'providers.manageHosts') {
      window.location.assign('../host/index.html');
      return;
    }
    if (button.dataset.action === 'performance.diagnostics' || button.dataset.action === 'advanced.exportDiagnostics') {
      window.location.assign('../diagnostics/index.html');
      return;
    }
    if (button.dataset.action === 'emulation.manageCores' || button.dataset.action === 'emulation.importFirmware') {
      window.location.assign('../emulation/index.html');
      return;
    }
    const status = document.querySelector('[data-save-status]');
    if (status) status.textContent = `${button.textContent} queued`;
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

document.querySelector('[data-export]').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({version: 1, exportedAt: new Date().toISOString(), settings: state}, null, 2)], {type: 'application/json'});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'spartan-gaming-settings.json';
  link.click();
  URL.revokeObjectURL(link.href);
});

render();
