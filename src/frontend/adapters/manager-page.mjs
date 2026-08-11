import '../pwa/register.mjs';
import { createSettingsStore } from '../settings/profile.mjs';
import {
  createAdapterManagerModel,
  detectAdapterPlatform,
  readAdapterManifestBundle,
} from './manager.mjs';

const state = {
  cores: [],
  records: [],
  platform: detectAdapterPlatform(),
  allowUnsigned: false,
  query: '',
  model: null,
};
const runtimeList = document.querySelector('[data-runtime-list]');
const manifestList = document.querySelector('[data-manifest-list]');
const notice = document.querySelector('[data-notice]');
let timer;
function escapeHtml(value) {
  return String(value).replace(
    /[&<>'"]/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '\"': '&quot;' })[character],
  );
}
function toast(message) {
  notice.textContent = message;
  notice.classList.add('visible');
  clearTimeout(timer);
  timer = setTimeout(() => notice.classList.remove('visible'), 2800);
}
function statusLabel(row) {
  return row.status === 'browser-runtime'
    ? 'Browser-WASM eligible'
    : row.status === 'ready'
      ? `Signed · ${row.adapter.version}`
      : row.status === 'ready-unsigned'
        ? `Unsigned dev · ${row.adapter.version}`
        : row.status === 'blocked'
          ? 'Blocked by trust policy'
          : 'Adapter not installed';
}
function render() {
  const query = state.query.toLowerCase();
  const rows =
    state.model?.rows.filter((row) =>
      `${row.name} ${row.id} ${(row.systems || []).join(' ')}`.toLowerCase().includes(query),
    ) || [];
  document.querySelector('[data-core-count]').textContent = state.cores.length;
  document.querySelector('[data-manifest-count]').textContent = state.model?.manifests.length || 0;
  document.querySelector('[data-browser-count]').textContent =
    state.model?.rows.filter((row) => row.browserReady).length || 0;
  document.querySelector('[data-status]').textContent = `${state.platform} · ${rows.length} shown`;
  runtimeList.innerHTML = rows.length
    ? rows
        .map(
          (row) =>
            `<article class="runtime-row"><div><h3>${escapeHtml(row.name)}</h3><p>${escapeHtml(row.id)} · ${escapeHtml(row.mode)} · ${escapeHtml(row.license || 'License not declared')}</p><div class="tags">${row.systems.map((system) => `<span class="tag">${escapeHtml(system)}</span>`).join('')}</div></div><span class="status ${escapeHtml(row.status)}">${escapeHtml(statusLabel(row))}</span><small>${escapeHtml(row.reason || 'Ready for the selected runtime.')}</small></article>`,
        )
        .join('')
    : '<p class="empty">No cores match this search.</p>';
  const manifests = state.model?.manifests || [];
  manifestList.innerHTML = manifests.length
    ? manifests
        .map(
          (record) =>
            `<article class="manifest-row"><div><strong>${escapeHtml(record.id)}</strong><small>${escapeHtml(record.kind)} · v${escapeHtml(record.version)} · ${escapeHtml(record.platforms.join(', '))}</small></div><span class="status ${record.trust === 'signed' ? 'ready' : 'blocked'}">${escapeHtml(record.trust)}</span><small>${escapeHtml(record.signature?.signer || 'No release signer')}</small></article>`,
        )
        .join('')
    : '<p class="empty">No adapter manifests have been injected or imported.</p>';
}
function rebuild() {
  state.model = createAdapterManagerModel({
    cores: state.cores,
    records: state.records,
    platform: state.platform,
    allowUnsigned: state.allowUnsigned,
  });
  render();
}
async function load() {
  try {
    const manifest = await fetch('../../../emulators/catalog.json').then((response) =>
      response.json(),
    );
    state.cores = manifest.projects;
    const injected = globalThis.__SPARTAN_ADAPTER_MANIFESTS__;
    if (injected) state.records = [...readAdapterManifestBundle(injected)];
    state.allowUnsigned = createSettingsStore().read()['advanced.allowUnsignedAdapters'] === true;
    document.querySelector('[data-platform]').value = state.platform;
    rebuild();
  } catch (error) {
    runtimeList.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`;
  }
}
document.querySelector('[data-search]').addEventListener('input', (event) => {
  state.query = event.target.value;
  render();
});
document.querySelector('[data-platform]').addEventListener('change', (event) => {
  state.platform = event.target.value;
  rebuild();
});
document.querySelector('[data-unsigned]').addEventListener('change', (event) => {
  state.allowUnsigned = event.target.checked;
  rebuild();
});
document
  .querySelector('[data-import]')
  .addEventListener('click', () => document.querySelector('[data-file]').click());
document.querySelector('[data-file]').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    state.records = [...readAdapterManifestBundle(await file.text())];
    rebuild();
    toast(
      `${state.records.length} verified manifest${state.records.length === 1 ? '' : 's'} loaded.`,
    );
  } catch (error) {
    toast(`Manifest import rejected: ${error.message}`);
  }
  event.target.value = '';
});
load();
