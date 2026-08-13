import '../pwa/register.mjs';
import { createProviderProfileStore } from './profiles.mjs';
import { BUILTIN_CONTROLLER_PROFILES, createControllerProfileStore } from '../input/profiles.mjs';
import { checkProviderReachability } from './health.mjs';
import { consumeLaunchIntent } from '../launch/intent.mjs';
import {
  createCommunityProviderCatalogStore,
  mergeCommunityProviders,
} from './community-catalog.mjs';
import { createActiveProfileStorage } from '../profiles/storage.mjs';
import { CONTROLLER_PROFILE_OPTIONS } from '../input/controller-policy.mjs';

const profileStorage = createActiveProfileStorage();
const store = createProviderProfileStore({ storage: profileStorage });
const controllerStore = createControllerProfileStore({ storage: profileStorage });
const communityCatalog = createCommunityProviderCatalogStore();
const providerContainer = document.querySelector('[data-providers]');
const editor = document.querySelector('[data-editor]');
const notice = document.querySelector('[data-notice]');
let providers = [];
let selectedId = null;
let timer;
function escapeHtml(value) {
  return String(value).replace(
    /[&<>\'"]/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character],
  );
}
function showNotice(message) {
  notice.textContent = message;
  notice.classList.add('visible');
  clearTimeout(timer);
  timer = setTimeout(() => notice.classList.remove('visible'), 2400);
}
function controllerProfileOptions() {
  const custom = controllerStore
    .list()
    .filter((profile) => !BUILTIN_CONTROLLER_PROFILES.some((builtin) => builtin.id === profile.id));
  return [
    ...CONTROLLER_PROFILE_OPTIONS.map((option) => ({ value: option, label: option })),
    ...custom.map((profile) => ({ value: profile.id, label: `${profile.name} (custom)` })),
  ];
}
function renderProviders() {
  document.querySelector('[data-count]').textContent = `${providers.length} services`;
  providerContainer.className = '';
  providerContainer.innerHTML = providers
    .map((provider) => {
      const accounts = store.list(provider.id);
      const profile = accounts[0];
      const accountCount = accounts.length;
      const label =
        accountCount > 1
          ? `${accountCount} accounts`
          : profile?.accountLabel || 'No local profile configured';
      return `<button class="provider-item ${provider.id === selectedId ? 'active' : ''}" data-provider="${escapeHtml(provider.id)}"><strong>${escapeHtml(provider.name)}</strong><small>${escapeHtml(label)}</small></button>`;
    })
    .join('');
}
function renderEditor() {
  const provider = providers.find((item) => item.id === selectedId);
  if (!provider) {
    editor.className = 'empty';
    editor.textContent = 'Select a provider to configure its profile.';
    return;
  }
  const profile = store.get(provider.id) || {
    providerId: provider.id,
    accountLabel: '',
    region: 'automatic',
    quality: 'balanced',
    launchMode: 'browser',
    controllerProfile: 'Auto-detect',
    autoFullscreen: true,
    embedTarget: '',
    notes: '',
  };
  editor.className = '';
  const targetHint =
    provider.id === 'twitch'
      ? 'Twitch channel username'
      : provider.id === 'youtube-live'
        ? 'YouTube video ID'
        : provider.id === 'kick'
          ? 'KICK channel username'
          : 'Optional official target';
  const controllerOptions = controllerProfileOptions()
    .map(
      (option) =>
        `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`,
    )
    .join('');
  editor.innerHTML = `<div class="editor-title"><p class="eyebrow">${escapeHtml(provider.kind)}</p><h2>${escapeHtml(provider.name)}</h2><p>${escapeHtml(provider.url)} · ${escapeHtml(provider.supportLevel)} support</p></div><div class="health-check panel"><div><p class="eyebrow">REACHABILITY ONLY</p><strong>Check official service</strong><small>No credentials, cookies, or response bodies are sent to Spartan Gaming.</small></div><button class="secondary" data-health type="button">Check availability</button><span data-health-result>Not checked</span></div><div class="form"><label>Account label<input data-account value="${escapeHtml(profile.accountLabel)}" maxlength="80" placeholder="e.g. Personal account"></label><label>Region hint<select data-region><option value="automatic">Automatic</option><option value="north-america">North America</option><option value="europe">Europe</option><option value="asia-pacific">Asia Pacific</option><option value="latin-america">Latin America</option></select></label><label>Quality preference<select data-quality><option value="prefer-latency">Prefer latency</option><option value="balanced">Balanced</option><option value="prefer-quality">Prefer quality</option></select></label><label>Launch preference<select data-launch><option value="browser">Spartan browser</option><option value="official">Official provider launch</option><option value="native">Native app when available</option></select></label><label>Controller profile<select data-controller>${controllerOptions}</select><small>Overrides the workspace controller profile for this provider’s session surfaces.</small></label><label>Embed target <input data-embed-target value="${escapeHtml(profile.embedTarget)}" maxlength="128" placeholder="${escapeHtml(targetHint)}"><small>Optional, non-secret target used only for an official embedded player.</small></label><label class="check wide"><input data-fullscreen type="checkbox" ${profile.autoFullscreen ? 'checked' : ''}> Request fullscreen when this provider starts a session</label><label class="wide">Private notes<textarea data-notes maxlength="500" placeholder="Non-secret reminders for this provider">${escapeHtml(profile.notes)}</textarea></label></div><div class="save-row"><button class="secondary" data-clear>Clear profile</button><button class="primary" data-save>Save profile</button></div>`;
  editor.querySelector('[data-region]').value = profile.region;
  editor.querySelector('[data-quality]').value = profile.quality;
  editor.querySelector('[data-launch]').value = profile.launchMode;
  editor.querySelector('[data-controller]').value = profile.controllerProfile;
}
function selectProvider(id) {
  selectedId = id;
  renderProviders();
  renderEditor();
}
providerContainer.addEventListener('click', (event) => {
  const button = event.target.closest('[data-provider]');
  if (button) selectProvider(button.dataset.provider);
});
editor.addEventListener('click', async (event) => {
  const provider = providers.find((item) => item.id === selectedId);
  if (!provider) return;
  if (event.target.closest('[data-health]')) {
    const output = editor.querySelector('[data-health-result]');
    output.textContent = 'Checking…';
    try {
      const health = await checkProviderReachability({ url: provider.url });
      output.textContent = `${health.status} · ${health.reason}`;
    } catch (error) {
      output.textContent = `invalid · ${error.message}`;
    }
    return;
  }
  if (event.target.closest('[data-save]')) {
    store.save({
      providerId: provider.id,
      accountLabel: editor.querySelector('[data-account]').value,
      region: editor.querySelector('[data-region]').value,
      quality: editor.querySelector('[data-quality]').value,
      launchMode: editor.querySelector('[data-launch]').value,
      controllerProfile: editor.querySelector('[data-controller]').value,
      autoFullscreen: editor.querySelector('[data-fullscreen]').checked,
      embedTarget: editor.querySelector('[data-embed-target]').value,
      notes: editor.querySelector('[data-notes]').value,
    });
    renderProviders();
    showNotice(`${provider.name} profile saved`);
  }
  if (event.target.closest('[data-clear]')) {
    store.remove(provider.id);
    renderProviders();
    renderEditor();
    showNotice(`${provider.name} profile cleared`);
  }
});
document.querySelector('[data-export]').addEventListener('click', () => {
  const blob = new Blob([store.export()], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'spartan-provider-profiles.json';
  link.click();
  URL.revokeObjectURL(link.href);
  showNotice('Provider profiles exported');
});
document.querySelector('[data-catalog-export]').addEventListener('click', () => {
  const blob = new Blob([communityCatalog.export()], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'spartan-community-provider-catalog.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
  showNotice('Community catalog exported');
});
document.querySelector('[data-catalog-import]').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    communityCatalog.import(await file.text());
    await load();
    showNotice('Community catalog imported');
  } catch (error) {
    showNotice(error.message);
  }
  event.target.value = '';
});
document.querySelector('[data-import]').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    store.import(await file.text());
    renderProviders();
    renderEditor();
    showNotice('Provider profiles imported');
  } catch (error) {
    showNotice(error.message);
  }
  event.target.value = '';
});
async function load() {
  try {
    const manifest = await fetch('../../../providers/catalog.json').then((response) =>
      response.json(),
    );
    providers = mergeCommunityProviders({
      providers: manifest.providers,
      community: communityCatalog.list(),
    });
    const intent = consumeLaunchIntent(sessionStorage, {
      backendType: 'provider',
      action: 'open-url',
    });
    selectedId =
      providers.find((provider) => provider.id === intent?.backendId)?.id ||
      providers[0]?.id ||
      null;
    renderProviders();
    renderEditor();
    if (intent && selectedId === intent.backendId)
      showNotice(
        `${providers.find((provider) => provider.id === selectedId).name} launch handoff loaded`,
      );
  } catch (error) {
    providerContainer.className = 'empty';
    providerContainer.textContent = error.message;
  }
}
load();
