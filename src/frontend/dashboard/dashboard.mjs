import '../pwa/register.mjs';
import { createFrontendCatalog, validateCatalogManifest } from '../catalog.mjs';
import { createSessionManager } from '../session/session.mjs';
import { createCatalogAdapterRegistry } from '../adapters/adapters.mjs';
import { evaluateCatalog } from '../compatibility/harness.mjs';
import { collectCapabilities } from '../diagnostics/capabilities.mjs';
import {
  applyGlobalProviderPreferences,
  createProviderProfileStore,
} from '../providers/profiles.mjs';
import { createLaunchIntent, saveLaunchIntent } from '../launch/intent.mjs';
import { createLaunchHistoryStore } from '../launch/history.mjs';
import { resolveDashboardSection } from './routes.mjs';
import {
  resolveRecoveryPresentation,
  resolveResumeEntry,
  resolveResumePresentation,
} from './resume.mjs';
import { createReadinessStatus } from '../readiness/status.mjs';
import {
  applyWorkspaceProviderDefaults,
  createWorkspaceStore,
  resolveWorkspaceLaunchBehavior,
} from '../workspaces/workspaces.mjs';
import {
  createFavoritesStore,
  createRomLibraryStore,
  createImportedGameStore,
  detectRomSystem,
  detectRomMime,
} from './library-state.mjs';
import {
  createCommunityProviderCatalogStore,
  mergeCommunityProviders,
} from '../providers/community-catalog.mjs';
import { createSettingsStore } from '../settings/profile.mjs';
import { launchExternalSurface } from '../launch/behavior.mjs';
import { checkProviderCatalog } from '../providers/catalog-health.mjs';
import { resolveProviderSessionOptions } from '../providers/session-options.mjs';
import { resolveProviderStartupPolicy } from '../providers/startup-policy.mjs';
import {
  clearSessionRecoveryHandoff,
  readSessionRecoveryHandoff,
} from '../session/recovery-handoff.mjs';
import { resolveStartupRoute } from '../startup/route.mjs';
import { createActiveProfileStorage } from '../profiles/storage.mjs';
import { createProviderDetailsModel } from '../providers/details.mjs';
import { createCloudGameDeepLink } from '../providers/cloud-features.mjs';
import { nextConsoleMode, resolveConsoleMode } from '../platform/console-mode.mjs';
import { resolveElectronRuntimeSettings } from '../settings/electron-runtime.mjs';
import { applyRuntimeUiSettings } from '../settings/runtime-ui.mjs';
import { resolveEmulatorCoreForRom } from '../emulation/core-selection.mjs';
import { discoveryOptions, matchesDiscovery, searchSuggestions } from './discovery.mjs';

const profileStorage = createActiveProfileStorage();
const launchHistory = createLaunchHistoryStore({ storage: profileStorage });
const workspaceStore = createWorkspaceStore({ storage: profileStorage });
const communityCatalogStore = createCommunityProviderCatalogStore();
const settings = createSettingsStore().read();
const settingsStore = createSettingsStore();
const electronRuntimeSettings = resolveElectronRuntimeSettings(settings);
globalThis.spartanElectron?.applyRuntimeSettings?.(JSON.stringify(electronRuntimeSettings));
const providerStartupPolicy = resolveProviderStartupPolicy(settings);
const recoveryHandoff =
  settings['general.restoreSession'] !== false ? readSessionRecoveryHandoff(sessionStorage) : null;
const startupRoute =
  new URLSearchParams(globalThis.location?.search || '').get('startup') === '1'
    ? resolveStartupRoute(settings, {
        recovery: recoveryHandoff,
        lastLaunch: launchHistory.latest(),
      })
    : null;
if (startupRoute && typeof globalThis.location?.replace === 'function')
  globalThis.location.replace(startupRoute);
let activeWorkspace = workspaceStore.active;
let favoritesStore = createFavoritesStore({
  storage: profileStorage,
  workspaceId: activeWorkspace.id,
});
const romLibraryStore = createRomLibraryStore({
  storage: profileStorage,
  workspaceId: activeWorkspace.id,
});
const importedGameStore = createImportedGameStore({ storage: profileStorage });
const requestedFilter = new URLSearchParams(globalThis.location?.search || '').get('filter');
const state = {
  catalog: [],
  adapters: null,
  compatibility: null,
  report: null,
  providerHealth: new Map(),
  filter: [
    'all',
    'cloud',
    'watch',
    'browser',
    'emulator',
    'favorites',
    'recent',
    'rom-library',
    'imported',
  ].includes(requestedFilter)
    ? requestedFilter
    : 'all',
  search: '',
  provider: '',
  platform: '',
  input: '',
  readiness: '',
  favorites: new Set(favoritesStore.list()),
  recent: new Set(launchHistory.list().map((record) => record.backendId)),
  lastLaunch: launchHistory.latest(),
  recovery: recoveryHandoff,
  providerProfiles: Object.fromEntries(
    createProviderProfileStore({ storage: profileStorage })
      .list()
      .map((profile) => [
        profile.providerId,
        applyGlobalProviderPreferences(
          { ...profile, embedParent: globalThis.location?.hostname || '' },
          settings,
        ),
      ]),
  ),
  romLibrary: romLibraryStore,
};
let queuedDeepLink = null;
document
  .querySelector('.filters')
  ?.insertAdjacentHTML(
    'beforeend',
    '<button class="filter" data-filter="watch">Watch &amp; stream</button>',
  );
document
  .querySelector('.filters')
  ?.insertAdjacentHTML(
    'beforeend',
    '<button class="filter" data-filter="browser">Browser games</button>',
  );
document
  .querySelector('.filters')
  ?.insertAdjacentHTML(
    'beforeend',
    '<button class="filter" data-filter="rom-library">ROM Library</button>',
  );
document
  .querySelector('.topbar')
  ?.insertAdjacentHTML(
    'beforeend',
    '<button class="rom-import" data-action="import-roms" aria-label="Import ROM files">▼ Import ROMs</button>',
  );

document
  .querySelector('.topbar')
  ?.insertAdjacentHTML(
    'beforeend',
    '<button class="rom-scan" data-action="scan-folder" aria-label="Scan folder for ROMs">▼ Scan Folder</button>',
  );
document
  .querySelector('.topbar')
  ?.insertAdjacentHTML(
    'beforeend',
    '<button class="add-game" data-action="add-game" aria-label="Add game from catalog">＋ Add game</button>',
  );
document
  .querySelector('.main-nav')
  ?.insertAdjacentHTML(
    'beforeend',
    '<button class="nav-item" data-section="browser">▣ <span>Browser games</span></button>',
  );
const cards = document.querySelector('[data-cards]');
const resultCount = document.querySelector('[data-result-count]');
const toast = document.querySelector('[data-toast]');
const sessionStatus = document.querySelector('[data-session-status]');
const statusPill = sessionStatus.closest('.status-pill');
const searchInput = document.querySelector('[data-search]');
const searchSuggestionsList = document.querySelector('[data-search-suggestions]');
const providerDialog = document.querySelector('[data-provider-dialog]');
const WATCH_KINDS = new Set(['live-streaming', 'social-streaming', 'self-hosted-live-streaming']);
const sessionManager = createSessionManager({ idFactory: () => `ses-${crypto.randomUUID()}` });
let consoleMode = resolveConsoleMode({
  settings,
  deviceMode: String(settings['appearance.deviceMode'] || 'desktop').toLowerCase(),
});
document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="./console-mode.css">');
document.body.classList.toggle('console-mode', consoleMode);
document
  .querySelector('.topbar')
  ?.insertAdjacentHTML(
    'beforeend',
    '<button class="console-mode-toggle" data-console-mode-toggle type="button" aria-pressed="false">▣ Console Mode</button>',
  );
const consoleModeToggle = document.querySelector('[data-console-mode-toggle]');
function renderConsoleMode() {
  document.body.classList.toggle('console-mode', consoleMode);
  if (consoleModeToggle) {
    consoleModeToggle.setAttribute('aria-pressed', String(consoleMode));
    consoleModeToggle.textContent = consoleMode ? '▣ Exit Console Mode' : '▣ Console Mode';
  }
}
consoleModeToggle?.addEventListener('click', () => {
  consoleMode = nextConsoleMode(consoleMode);
  const nextSettings = { ...settings, 'appearance.consoleMode': consoleMode };
  settingsStore.save(nextSettings);
  applyRuntimeUiSettings(document, nextSettings);
  renderConsoleMode();
  showToast(consoleMode ? 'Console Mode enabled' : 'Console Mode disabled');
});
let sessionStatusId = 'idle';
let toastTimer;
let selectedProviderDetails = null;
let providerReturnFocus = null;
resultCount?.setAttribute('aria-live', 'polite');
document
  .querySelector('.topbar')
  ?.insertAdjacentHTML(
    'beforeend',
    '<label class="workspace-picker" style="display:flex;align-items:center;gap:7px;color:#8d9aa7;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase"><span>Workspace</span><select data-workspace-select aria-label="Active workspace" style="min-width:118px;padding:8px 9px;border:1px solid #2a3540;border-radius:7px;background:#171e26;color:#e7edf3;font-size:11px;letter-spacing:0;text-transform:none"></select></label>',
  );

function renderWorkspaceControl() {
  const control = document.querySelector('[data-workspace-select]');
  if (!control) return;
  control.innerHTML = workspaceStore
    .list()
    .map(
      (workspace) =>
        `<option value="${escapeHtml(workspace.id)}" ${workspace.id === activeWorkspace.id ? 'selected' : ''}>${escapeHtml(workspace.name)}</option>`,
    )
    .join('');
  control.title = `${activeWorkspace.name} workspace`;
}
function workspaceProviderProfiles() {
  return Object.fromEntries(
    state.catalog
      .filter((entry) => entry.backendType === 'provider')
      .map((entry) => [
        entry.id,
        applyWorkspaceProviderDefaults(
          activeWorkspace,
          applyGlobalProviderPreferences(state.providerProfiles[entry.id] || {}, settings),
        ),
      ]),
  );
}
function rebuildAdapters() {
  if (!state.catalog.length) return;
  state.adapters = createCatalogAdapterRegistry(state.catalog, {
    providerProfiles: workspaceProviderProfiles(),
    report: () => state.report || {},
  });
}
function saveFavorites() {
  favoritesStore.set([...state.favorites]);
}
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
}
function updateReadinessStatus() {
  const status = createReadinessStatus({
    catalogLoaded: state.catalog.length > 0,
    compatibility: state.compatibility,
    capabilityReport: state.report,
    online: globalThis.navigator?.onLine !== false,
    activeSession: sessionStatusId,
  });
  sessionStatus.textContent = status.label;
  statusPill.dataset.status = status.id;
  statusPill.title = status.detail;
}
function setSessionStatus(status) {
  sessionStatusId = status;
  updateReadinessStatus();
}
function providerHealthLabel(entry) {
  const health = state.providerHealth.get(entry.id);
  if (!health) return '';
  if (health.status === 'checking') return ' · Checking';
  if (health.status === 'reachable')
    return ` · Reachable${health.latencyMs ? ` ${health.latencyMs}ms` : ''}`;
  if (health.status === 'unavailable') return ' · Unavailable';
  if (health.status === 'timeout') return ' · Timed out';
  return ' · Check inconclusive';
}
function renderResume() {
  const presentation =
    resolveRecoveryPresentation(state.recovery) || resolveResumePresentation(state.lastLaunch);
  const title = document.querySelector('[data-resume-title]');
  const copy = document.querySelector('[data-resume-copy]');
  const button = document.querySelector('[data-action="resume"]');
  title.textContent = presentation.title;
  copy.textContent = presentation.copy;
  button.textContent = presentation.actionLabel;
}
function openProviderSurface(entry, plan) {
  providerReturnFocus =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const integration = plan.integration || {};
  if (globalThis.SpartanAndroid && plan.url) {
    window.location.assign(plan.url);
    return;
  }
  if (
    globalThis.spartanElectron?.isElectron &&
    typeof globalThis.spartanElectron.openProvider === 'function'
  ) {
    globalThis.spartanElectron
      .openProvider(
        plan.url,
        entry.name,
        resolveProviderSessionOptions(settings, { profileId: profileStorage.profileId }),
      )
      .catch((error) => showToast(error.message));
    showToast(`${entry.name}: official player opened.`);
    return;
  }
  document.querySelector('[data-provider-title]').textContent = entry.name;
  document.querySelector('[data-provider-detail]').textContent =
    `${integration.surfaces?.length ? integration.surfaces.join(' · ') : entry.kind} · ${integration.quality || 'balanced'} quality · ${integration.regionLabel || 'Automatic'} region`;
  document.querySelector('[data-provider-frame]').src = plan.url;
  const external = document.querySelector('[data-provider-external]');
  external.href = plan.url;
  const notes = [
    ...(integration.notes || []),
    ...(plan.readiness?.issues || []).map((issue) => issue.message),
    ...(integration.requirements?.length ? [`Setup: ${integration.requirements.join(', ')}`] : []),
    'Authentication and provider permissions remain on the official service.',
  ];
  document.querySelector('[data-provider-notes]').textContent = notes.join(' ');
  if (typeof providerDialog.showModal === 'function') providerDialog.showModal();
  else providerDialog.setAttribute('open', '');
}
function closeProviderSurface() {
  if (
    globalThis.spartanElectron?.isElectron &&
    typeof globalThis.spartanElectron.closeProvider === 'function'
  ) {
    void globalThis.spartanElectron.closeProvider();
    return;
  }
  document.querySelector('[data-provider-frame]').src = 'about:blank';
  if (typeof providerDialog.close === 'function' && providerDialog.open) providerDialog.close();
  else providerDialog.removeAttribute('open');
}
function openProviderDetails(entry, plan) {
  const dialog = document.querySelector('[data-provider-details-dialog]');
  const content = document.querySelector('[data-provider-details]');
  if (!dialog || !content) return;
  selectedProviderDetails = { entry, plan };
  const model = createProviderDetailsModel(entry, plan);
  document.querySelector('[data-provider-details-title]').textContent = model.name;
  document.querySelector('[data-provider-details-subtitle]').textContent =
    `${model.kind} · Support ${model.supportLevel} · ${model.readinessStatus.replace(/-/g, ' ')}`;
  const deepLinkHtml = model.deepLinkSupported
    ? `<div class="details-deeplink" style="margin-top:14px;padding:12px;border:1px solid #2a3540;border-radius:8px;background:#171e26"><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:#a0aec0">Direct Game Launch (Deep Link)</label><div style="display:flex;gap:8px"><input type="text" data-deeplink-game placeholder="Enter Game Title or ID (e.g. Halo Infinite)" style="flex:1;padding:6px 10px;border:1px solid #2a3540;border-radius:6px;background:#0d1117;color:#fff;font-size:12px"><button type="button" data-deeplink-launch style="padding:6px 14px;border:0;border-radius:6px;background:#50e1d1;color:#0d1117;font-weight:700;cursor:pointer">Launch Game</button></div></div>`
    : '';
  content.innerHTML = `<div class="details-summary"><p>${escapeHtml(model.readinessReason)}</p><div class="details-facts"><span><strong>Mode</strong>${escapeHtml(model.mode || 'Unavailable')}</span><span><strong>Quality</strong>${escapeHtml(model.quality)}</span><span><strong>Data Usage</strong>~${escapeHtml(model.bandwidthEstimate.totalGb)} GB/hr</span><span><strong>Region</strong>${escapeHtml(model.regionLabel)}</span><span><strong>Controller</strong>${escapeHtml(model.controllerProfile)}</span></div>${deepLinkHtml}</div><div class="details-columns"><section><h3>Supported surfaces</h3><p>${escapeHtml(model.surfaces.join(' · ') || 'Official web experience')}</p><h3>Capabilities</h3><p>${escapeHtml(model.capabilities.join(' · ') || 'Provider-defined')}</p></section><section><h3>Setup requirements</h3><p>${escapeHtml(model.requirements.join(' · ') || 'None listed')}</p><h3>Readiness notes</h3><p>${escapeHtml([...model.troubleshooting, ...model.notes, ...(model.blocking.length ? [`Blocking: ${model.blocking.join(', ')}`] : [])].join(' ') || 'No additional notes.')}</p></section></div><p class="details-privacy">Authentication, subscriptions, provider permissions, and account sessions remain on the official service. Spartan Gaming stores no provider tokens in this flow.</p>`;
  content.querySelector('[data-deeplink-launch]')?.addEventListener('click', () => {
    const input = content.querySelector('[data-deeplink-game]');
    const gameId = input?.value?.trim();
    if (!gameId) return;
    const url = createCloudGameDeepLink(model.providerId, gameId);
    if (url) {
      closeProviderDetails();
      launchEntry(entry, { ...plan, action: 'open-url', url });
    }
  });
  document.querySelector('[data-provider-details-external]').href = model.url;
  document.querySelector('[data-provider-details-launch]').textContent =
    model.action === 'embed-url' ? 'Open official player' : 'Open official service';
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}
function closeProviderDetails() {
  const dialog = document.querySelector('[data-provider-details-dialog]');
  selectedProviderDetails = null;
  if (typeof dialog?.close === 'function' && dialog.open) dialog.close();
  else dialog?.removeAttribute('open');
}
function launchEntry(entry, plan) {
  if (state.recovery) {
    clearSessionRecoveryHandoff(sessionStorage);
    state.recovery = null;
  }
  state.recent.add(entry.id);
  state.lastLaunch = launchHistory.record({
    backendId: entry.id,
    backendType: entry.backendType,
    name: entry.name,
    mode: plan.mode,
    action: plan.action,
    at: new Date().toISOString(),
  });
  renderResume();
  render();
  saveLaunchIntent(
    sessionStorage,
    createLaunchIntent({
      entry,
      plan,
      profileId: activeWorkspace.id,
      controllerProfile: plan.integration?.controllerProfile,
      returnTo: './index.html',
    }),
  );
  if (plan.readiness?.nextAction === 'run-diagnostics') {
    window.location.assign('../diagnostics/index.html');
    return;
  }
  if (
    plan.readiness?.nextAction === 'choose-runtime' ||
    plan.action === 'choose-runtime' ||
    plan.action === 'configure-native-adapter'
  ) {
    window.location.assign('../emulation/index.html');
    return;
  }
  if (plan.action === 'configure-host') {
    window.location.assign('../host/index.html');
    return;
  }
  if (plan.action === 'embed-url') {
    openProviderSurface(entry, plan);
    showToast(`${entry.name}: official embed opened.`);
    return;
  }
  if (plan.action === 'open-native-client') {
    const launch = plan.nativeLaunch;
    if (launch?.discovery?.found === true) {
      showToast(`${entry.name}: launch via the official ${launch.client.name} client.`);
      launchExternalSurface(launch.client.officialUrl, {
        behavior: resolveWorkspaceLaunchBehavior(
          activeWorkspace,
          settings['gaming.launchBehavior'],
        ),
        open: window.open.bind(window),
        assign: window.location.assign.bind(window.location),
      });
      return;
    }
    if (launch?.status === 'ready' && launch.client?.officialUrl) {
      showToast(
        `${entry.name}: official native client not detected. Opening the download page in Spartan Gaming.`,
      );
      openProviderSurface(entry, { ...plan, action: 'embed-url', url: launch.client.officialUrl });
      return;
    }
    showToast(
      `${entry.name}: native client launch needs the official app installed and signed in.`,
    );
    return;
  }
  if (plan.action === 'open-url' || plan.action === 'configure-api') {
    try {
      const handoff = launchExternalSurface(plan.url, {
        behavior: resolveWorkspaceLaunchBehavior(
          activeWorkspace,
          settings['gaming.launchBehavior'],
        ),
        open: window.open.bind(window),
        assign: window.location.assign.bind(window.location),
      });
      showToast(
        `${entry.name}: ${handoff.mode === 'current-workspace' ? 'official service opened here' : 'official service opened'}.`,
      );
    } catch (error) {
      showToast(error.message);
    }
    return;
  }
  const offer = beginSession({ ...entry, adapterMode: plan.mode });
  if (offer) showToast(`${entry.name}: ${plan.action.replace(/-/g, ' ')}.`);
}
function handleDeepLink(link) {
  if (!link?.version || link.action !== 'launch' || typeof link.backendId !== 'string') return;
  if (!state.catalog.length || !state.adapters) {
    queuedDeepLink = link;
    return;
  }
  const entry = state.catalog.find((item) => item.id === link.backendId);
  const plan = entry && state.adapters.get(entry.id)?.resolve();
  if (!entry || !plan || plan.status === 'unsupported') {
    showToast(`Launch link unavailable: ${link.backendId}`);
    return;
  }
  launchEntry(entry, plan);
}
function consumeQueuedDeepLink() {
  const link = queuedDeepLink;
  queuedDeepLink = null;
  if (link) handleDeepLink(link);
}
function beginSession(backend) {
  if (
    sessionManager.state !== 'idle' &&
    sessionManager.state !== 'closed' &&
    sessionManager.state !== 'error'
  ) {
    showToast('A session is already negotiating. Close it before launching another.');
    return null;
  }
  if (sessionManager.state === 'closed' || sessionManager.state === 'error') sessionManager.reset();
  const offer = sessionManager.start({ backend });
  setSessionStatus('connecting');
  return offer;
}
function escapeHtml(value) {
  return String(value).replace(
    /[&<>'"]/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character],
  );
}
function visibleEntries() {
  const catalogEntries = state.catalog.filter((entry) => {
    const matchesType =
      state.filter === 'all' ||
      (state.filter === 'emulator'
        ? entry.backendType === 'emulator'
        : state.filter === 'browser'
          ? entry.backendType === 'game'
          : state.filter === 'cloud'
            ? entry.backendType === 'provider'
            : state.filter === 'watch'
              ? WATCH_KINDS.has(entry.kind)
              : state.filter === 'favorites'
                ? state.favorites.has(entry.id)
                : state.filter === 'rom-library'
                  ? entry.backendType === 'emulator' || entry.kind === 'multi-system'
                  : state.recent.has(entry.id));
    return (
      matchesType &&
      matchesDiscovery(
        entry,
        {
          search: state.search,
          provider: state.provider,
          platform: state.platform,
          input: state.input,
          readiness: state.readiness,
        },
        state.adapters,
      )
    );
  });
  const query = state.search.toLowerCase().trim();
  const imported = importedGameStore.list();
  const romEntries =
    state.filter === 'rom-library'
      ? state.romLibrary
          .list()
          .filter((rom) =>
            `${rom.name} ${rom.system} ${rom.extension}`.toLowerCase().includes(query),
          )
          .map((rom) => ({
            id: `rom:${rom.romPath}`,
            name: rom.name,
            backendType: 'rom',
            kind: 'rom-library',
            description: `${rom.system} · ${rom.extension.toUpperCase()} · core selected automatically`,
            systems: [rom.system],
            capabilities: ['gamepad', 'save-state'],
            rom,
          }))
      : [];
  const importedEntries =
    state.filter === 'all' || state.filter === 'imported'
      ? imported
          .filter((game) => {
            const haystack =
              `${game.name} ${game.providerId} ${(game.genres || []).join(' ')}`.toLowerCase();
            return !query || haystack.includes(query);
          })
          .map((game) => ({
            id: game.id,
            name: game.name,
            backendType: 'imported',
            kind: 'game-library',
            description: `Imported from ${game.providerId}`,
            systems: game.genres,
            capabilities: [],
            providerId: game.providerId,
            appId: game.appId,
            deepLink: game.deepLink,
            storeUrl: game.storeUrl,
          }))
      : [];
  return [...catalogEntries, ...romEntries, ...importedEntries];
}
function updateFilterControls() {
  document.querySelectorAll('[data-filter]').forEach((button) => {
    const active = button.dataset.filter === state.filter;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}
function renderDiscoveryOptions() {
  const options = discoveryOptions(state.catalog);
  const controls = [
    ['provider', 'Provider', options.providers],
    ['platform', 'Platform', options.platforms],
    ['input', 'Input', options.inputs],
  ];
  controls.forEach(([key, label, values]) => {
    const select = document.querySelector(`[data-discovery-filter="${key}"]`);
    if (!select) return;
    const current = state[key];
    select.innerHTML = `<option value="">${label}: All</option>${values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}`;
    select.value = values.includes(current) ? current : '';
  });
  const readiness = document.querySelector('[data-discovery-filter="readiness"]');
  if (readiness) {
    readiness.innerHTML = `<option value="">Readiness: All</option>${options.readiness.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}`;
    readiness.value = options.readiness.some(([value]) => value === state.readiness)
      ? state.readiness
      : '';
  }
  if (searchSuggestionsList) {
    searchSuggestionsList.innerHTML = searchSuggestions(state.catalog, state.search)
      .map((value) => `<option value="${escapeHtml(value)}"></option>`)
      .join('');
  }
}
function entryCardMarkup(entry) {
  const favorite = state.favorites.has(entry.id);
  const tags = [
    ...(state.recent.has(entry.id) ? ['Recent'] : []),
    ...(entry.systems || []).slice(0, 2),
    ...(entry.capabilities || []).slice(0, 1),
  ];
  const summary =
    entry.description ||
    (entry.requirements?.length
      ? entry.requirements.join(' · ')
      : entry.systems?.length
        ? entry.systems.join(' · ')
        : 'Ready to connect');
  const plan = state.adapters?.get(entry.id)?.resolve();
  const readiness =
    {
      ready: 'Ready',
      'configuration-required': 'Setup required',
      'browser-capability-missing': 'Capability missing',
      'native-adapter-required': 'Native adapter',
    }[plan?.readiness?.status] || 'Checking…';
  const actionLabel =
    plan?.readiness?.nextAction === 'run-diagnostics'
      ? 'Run diagnostics'
      : plan?.readiness?.nextAction === 'choose-runtime'
        ? 'Choose runtime'
        : entry.backendType === 'provider'
          ? 'Open service'
          : entry.backendType === 'imported'
            ? 'Play'
            : entry.backendType === 'rom'
              ? 'Open with core'
              : entry.backendType === 'game'
                ? 'Play in browser'
                : 'Configure';
  const nativeLaunch = plan?.nativeLaunch;
  const nativeTag = nativeLaunch
    ? nativeLaunch.discovery?.found === true
      ? 'Native client ready'
      : nativeLaunch.status === 'ready'
        ? 'Native client needed'
        : null
    : null;
  const cardType =
    entry.backendType === 'imported'
      ? entry.providerId || 'Game'
      : entry.backendType === 'rom'
        ? 'ROM Library'
        : entry.backendType === 'emulator'
          ? 'Emulation'
          : entry.backendType === 'game'
            ? 'Browser game'
            : entry.kind;
  const detailsLabel =
    entry.backendType === 'imported'
      ? entry.deepLink
        ? 'Deep link'
        : 'Store page'
      : entry.backendType === 'provider'
        ? providerHealthLabel(entry)
        : '';
  return `<article class="card"><div class="card-top"><span class="card-type">${escapeHtml(cardType)}</span><button class="favorite ${favorite ? 'is-favorite' : ''}" data-favorite="${escapeHtml(entry.id)}" aria-label="${favorite ? 'Remove' : 'Add'} ${escapeHtml(entry.name)} ${favorite ? 'from' : 'to'} favorites" aria-pressed="${favorite}">★</button></div><h3>${escapeHtml(entry.name)}</h3><p>${escapeHtml(summary)}</p><div class="chips">${tags.map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join('')}${nativeTag ? `<span class="chip native">${escapeHtml(nativeTag)}</span>` : ''}</div><div class="card-actions">${entry.backendType === 'provider' ? `<button class="details-button" data-details="${escapeHtml(entry.id)}">Details</button>` : ''}<button class="launch" data-launch="${escapeHtml(entry.id)}">${actionLabel}</button><span class="details">${escapeHtml(entry.supportLevel || 'Community')} · ${readiness}${detailsLabel ? ` · ${detailsLabel}` : ''}</span></div></article>`;
}
function renderShelf(title, eyebrow, entries, shelfId, filter = '') {
  if (!entries.length) return '';
  const viewAll = filter
    ? `<button type="button" class="shelf-view-all" data-shelf-filter="${filter}">View all</button>`
    : '';
  return `<section class="content-shelf" aria-labelledby="${shelfId}-title"><div class="shelf-heading"><div><p class="eyebrow">${eyebrow}</p><h3 id="${shelfId}-title">${title}</h3></div><div class="shelf-actions">${viewAll}<div class="shelf-controls"><button type="button" data-shelf-scroll="-1" data-shelf-target="${shelfId}" aria-label="Scroll ${title} left">←</button><button type="button" data-shelf-scroll="1" data-shelf-target="${shelfId}" aria-label="Scroll ${title} right">→</button></div></div></div><div class="shelf-viewport" data-shelf="${shelfId}">${entries.map(entryCardMarkup).join('')}</div></section>`;
}
function render() {
  renderWorkspaceControl();
  updateFilterControls();
  const entries = visibleEntries();
  resultCount.textContent = `${entries.length} connection${entries.length === 1 ? '' : 's'}`;
  if (!entries.length) {
    cards.innerHTML =
      '<div class="empty">No connections match this view. Try another filter or search term.</div>';
    return;
  }
  const isShelved =
    state.filter === 'all' &&
    !state.search.trim() &&
    !state.provider &&
    !state.platform &&
    !state.input &&
    !state.readiness;
  if (!isShelved) {
    cards.innerHTML = `<section class="content-shelf results-shelf" aria-labelledby="results-title"><div class="shelf-heading"><div><p class="eyebrow">YOUR RESULTS</p><h3 id="results-title">Connections</h3></div></div><div class="cards-grid">${entries.map(entryCardMarkup).join('')}</div></section>`;
    return;
  }
  const continueEntries = entries.filter(
    (entry) => state.recent.has(entry.id) || state.lastLaunch?.backendId === entry.id,
  );
  const continueIds = new Set(continueEntries.map((entry) => entry.id));
  const readyEntries = entries.filter(
    (entry) =>
      !continueIds.has(entry.id) &&
      state.adapters?.get(entry.id)?.resolve()?.readiness?.status === 'ready',
  );
  const readyIds = new Set(readyEntries.map((entry) => entry.id));
  const attentionEntries = entries.filter(
    (entry) => !continueIds.has(entry.id) && !readyIds.has(entry.id),
  );
  const attentionIds = new Set(attentionEntries.map((entry) => entry.id));
  const remaining = (predicate) =>
    entries.filter(
      (entry) => !continueIds.has(entry.id) && !attentionIds.has(entry.id) && predicate(entry),
    );
  const shelves = [
    renderShelf(
      'Continue Playing',
      'PICK UP WHERE YOU LEFT OFF',
      continueEntries,
      'continue-playing',
      'recent',
    ),
    renderShelf('Ready to Play', 'NO SETUP NEEDED', readyEntries, 'ready-to-play'),
    renderShelf('Needs Attention', 'ASSISTED SETUP', attentionEntries, 'needs-attention'),
    renderShelf(
      'Favorites',
      'SAVED FOR LATER',
      remaining((entry) => state.favorites.has(entry.id)),
      'favorites',
      'favorites',
    ),
    renderShelf(
      'Local Library',
      'ON THIS DEVICE',
      remaining((entry) => ['rom', 'imported', 'emulator'].includes(entry.backendType)),
      'local-library',
      'rom-library',
    ),
    renderShelf(
      'Cloud Providers',
      'PLAY IN THE CLOUD',
      remaining((entry) => entry.backendType === 'provider'),
      'cloud-providers',
      'cloud',
    ),
    renderShelf(
      'Watch & Stream',
      'LIVE AND SOCIAL',
      remaining((entry) => WATCH_KINDS.has(entry.kind)),
      'watch-stream',
      'watch',
    ),
    renderShelf(
      'Browser Games',
      'PLAY INSTANTLY',
      remaining((entry) => entry.backendType === 'game'),
      'browser-games',
      'browser',
    ),
    renderShelf(
      'Emulation',
      'YOUR CORES AND SYSTEMS',
      remaining((entry) => entry.backendType === 'emulator'),
      'emulation',
      'emulator',
    ),
  ];
  cards.innerHTML =
    shelves.join('') || '<div class="empty">Your library is ready for its first connection.</div>';
}
async function loadCatalog() {
  try {
    const readCatalog = (url) =>
      fetch(url).then((response) => {
        if (!response.ok) throw new Error(`catalog request failed: ${response.status}`);
        return response.json();
      });
    const [providers, emulators, games] = await Promise.all([
      readCatalog('../catalogs/providers.json'),
      readCatalog('../catalogs/emulators.json'),
      readCatalog('../catalogs/games.json'),
    ]);
    validateCatalogManifest(providers, 'provider');
    validateCatalogManifest(emulators, 'emulator');
    validateCatalogManifest(games, 'game');
    const catalog = createFrontendCatalog({
      providers: mergeCommunityProviders({
        providers: providers.providers,
        community: communityCatalogStore.list(),
      }),
      emulators: emulators.projects,
      games: games.games,
    });
    state.catalog =
      settings['providers.showCatalog'] === false
        ? catalog.entries.filter((entry) => entry.backendType !== 'provider')
        : catalog.entries.filter((entry) =>
            settings['providers.gameNativeCompanion'] === false ? entry.id !== 'gamenative' : true,
          );
    rebuildAdapters();
    renderDiscoveryOptions();
    updateReadinessStatus();
    render();
    consumeQueuedDeepLink();
    if (providerStartupPolicy.shouldProbe) {
      const providers = state.catalog.filter((entry) => entry.backendType === 'provider');
      providers.forEach((entry) => state.providerHealth.set(entry.id, { status: 'checking' }));
      render();
      checkProviderCatalog(providers)
        .then((results) => {
          results.forEach((item) => state.providerHealth.set(item.providerId, item.result));
          render();
        })
        .catch(() => {});
    }
    collectCapabilities()
      .then((report) => {
        state.report = report;
        state.compatibility = evaluateCatalog(state.catalog, report);
        updateReadinessStatus();
        render();
      })
      .catch(() => {
        state.report = {};
        state.compatibility = evaluateCatalog(state.catalog, state.report);
        updateReadinessStatus();
        render();
      });
  } catch (error) {
    cards.innerHTML =
      '<div class="empty">The library could not load. Check the catalog files and try again.</div>';
    console.error(error);
  }
}
searchInput.addEventListener('input', (event) => {
  state.search = event.target.value;
  renderDiscoveryOptions();
  render();
});
document.querySelector('[data-workspace-select]')?.addEventListener('change', (event) => {
  activeWorkspace = workspaceStore.setActive(event.target.value);
  favoritesStore = createFavoritesStore({
    storage: profileStorage,
    workspaceId: activeWorkspace.id,
  });
  state.favorites = new Set(favoritesStore.list());
  rebuildAdapters();
  render();
  showToast(`Using ${activeWorkspace.name} workspace`);
});
document.querySelectorAll('[data-filter]').forEach((button) =>
  button.addEventListener('click', () => {
    state.filter = button.dataset.filter;
    render();
  }),
);
document.querySelectorAll('[data-discovery-filter]').forEach((select) =>
  select.addEventListener('change', (event) => {
    state[event.target.dataset.discoveryFilter] = event.target.value;
    render();
  }),
);
updateFilterControls();
document.addEventListener('click', (event) => {
  const shelfFilter = event.target.closest('[data-shelf-filter]');
  if (shelfFilter) {
    state.filter = shelfFilter.dataset.shelfFilter;
    state.search = '';
    const search = document.querySelector('[data-search]');
    if (search) search.value = '';
    render();
    document
      .querySelector('.library-section')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const shelfButton = event.target.closest('[data-shelf-scroll]');
  if (shelfButton) {
    const shelf = document.querySelector(`[data-shelf="${shelfButton.dataset.shelfTarget}"]`);
    const distance = Math.max(260, Math.round((shelf?.clientWidth || 600) * 0.8));
    shelf?.scrollBy({
      left: Number(shelfButton.dataset.shelfScroll) * distance,
      behavior: 'smooth',
    });
    return;
  }
  const favoriteButton = event.target.closest('[data-favorite]');
  if (favoriteButton) {
    const id = favoriteButton.dataset.favorite;
    const next = favoritesStore.toggle(id);
    state.favorites = new Set(next);
    render();
    showToast(
      state.favorites.has(id)
        ? `Added to ${activeWorkspace.name} favorites`
        : `Removed from ${activeWorkspace.name} favorites`,
    );
    return;
  }
  const detailsButton = event.target.closest('[data-details]');
  if (detailsButton) {
    const entry = state.catalog.find((item) => item.id === detailsButton.dataset.details);
    const plan = entry && state.adapters?.get(entry.id)?.resolve();
    if (entry && plan) openProviderDetails(entry, plan);
    return;
  }
  const launchButton = event.target.closest('[data-launch]');
  if (launchButton) {
    const catalogEntry = state.catalog.find((item) => item.id === launchButton.dataset.launch);
    const romEntry = visibleEntries().find(
      (item) => item.id === launchButton.dataset.launch && item.backendType === 'rom',
    );
    const importedEntry = importedGameStore
      .list()
      .find((item) => item.id === launchButton.dataset.launch);
    const entry = catalogEntry || importedEntry;
    if (romEntry) {
      const core = resolveEmulatorCoreForRom(
        romEntry.rom,
        state.catalog.filter((item) => item.backendType === 'emulator'),
      );
      if (!core) {
        showToast('No emulator core is available for this ROM.');
        return;
      }
      sessionStorage.setItem(
        'spartan-gaming.pending-rom.v1',
        JSON.stringify({ rom: romEntry.rom, coreId: core.id }),
      );
      window.location.assign('../emulation/index.html');
      return;
    }
    if (!entry) return;
    if (importedEntry) {
      const target = importedEntry.deepLink || importedEntry.storeUrl;
      if (target) {
        try {
          const handoff = launchExternalSurface(target, {
            behavior: resolveWorkspaceLaunchBehavior(
              activeWorkspace,
              settings['gaming.launchBehavior'],
            ),
            open: window.open.bind(window),
            assign: window.location.assign.bind(window.location),
          });
          showToast(
            `${importedEntry.name}: ${handoff.mode === 'current-workspace' ? 'launched here' : 'launched'}.`,
          );
        } catch (error) {
          showToast(error.message);
        }
        return;
      }
      showToast(`${importedEntry.name}: no launch target configured.`);
      return;
    }
    const plan = state.adapters?.get(entry.id)?.resolve();
    if (!plan || plan.status === 'unsupported') {
      showToast(`${entry.name}: no supported integration mode is available.`);
      return;
    }
    launchEntry(entry, plan);
  }
  const importButton = event.target.closest('[data-action="import-roms"]');
  if (importButton) {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept =
      '.zip,.smc,.sfc,.nes,.gba,.gb,.gbc,.n64,.z64,.iso,.cue,.bin,.chd,.wbfs,.gcm,.cso,.nds,.3ds,.a26,.vec,.smd,.md,.sms,.gg,.pce,.ws,.rom';
    input.onchange = () => {
      const files = Array.from(input.files || []);
      if (files.length) {
        const selectedRoms = files.map((file) => {
          const path = `/imported/${file.name}`;
          const system = detectRomSystem(file.name);
          const name = file.name.split('.').shift();
          const extension = file.name.split('.').pop().toLowerCase();
          const mime = file.type || detectRomMime(file.name);
          return {
            romPath: path,
            system,
            extension,
            name,
            mime,
          };
        });
        state.romLibrary.importFromPaths(selectedRoms);
        showToast(`Imported ${selectedRoms.length} ROM(s)`);
        render();
      }
    };
    input.click();
    return;
  }
  const scanButton = event.target.closest('[data-action="scan-folder"]');
  if (scanButton) {
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.multiple = true;
    input.onchange = () => {
      const files = Array.from(input.files || []);
      if (files.length) {
        const selectedRoms = files.map((file) => {
          const path = file.webkitRelativePath || file.name;
          const system = detectRomSystem(file.name);
          const name = file.name.split('.').shift();
          const extension = file.name.split('.').pop().toLowerCase();
          const mime = file.type || detectRomMime(file.name);
          return {
            romPath: path,
            system,
            extension,
            name,
            mime,
          };
        });
        state.romLibrary.importFromPaths(selectedRoms);
        showToast(`Imported ${selectedRoms.length} ROM(s)`);
        render();
      }
    };
    input.click();
    return;
  }
  const addGameButton = event.target.closest('[data-action="add-game"]');
  if (addGameButton) {
    const dialog = document.querySelector('[data-add-game-dialog]');
    const nameInput = document.querySelector('[data-add-game-name]');
    const providerSelect = document.querySelector('[data-add-game-provider]');
    const appIdInput = document.querySelector('[data-add-game-appid]');
    if (nameInput) nameInput.value = '';
    if (providerSelect) providerSelect.value = '';
    if (appIdInput) appIdInput.value = '';
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    return;
  }
  const addGameClose = event.target.closest('[data-add-game-close]');
  if (addGameClose) {
    const dialog = document.querySelector('[data-add-game-dialog]');
    if (typeof dialog.close === 'function') dialog.close();
    else dialog?.removeAttribute('open');
    return;
  }
  const addGameSave = event.target.closest('[data-add-game-save]');
  if (addGameSave) {
    const nameInput = document.querySelector('[data-add-game-name]');
    const providerSelect = document.querySelector('[data-add-game-provider]');
    const appIdInput = document.querySelector('[data-add-game-appid]');
    const name = nameInput?.value?.trim();
    const providerId = providerSelect?.value?.trim();
    const appId = appIdInput?.value?.trim();
    if (!name || !providerId || !appId) {
      showToast('Please enter a game name, select a platform, and provide an app ID.');
      return;
    }
    const providerEntry = state.catalog.find((e) => e.id === providerId);
    const deepLinkFormats = providerEntry?.deepLinkFormats || {};
    const deepLink = deepLinkFormats.run?.replace('{appid}', appId) || null;
    const storeUrl = providerEntry?.url ? `${providerEntry.url}/app/${appId}` : null;
    importedGameStore.add({
      name,
      providerId,
      appId,
      deepLink,
      storeUrl,
      genres: [],
    });
    showToast(`Added ${name} to your library`);
    render();
    const dialog = document.querySelector('[data-add-game-dialog]');
    if (typeof dialog.close === 'function') dialog.close();
    else dialog?.removeAttribute('open');
    return;
  }
});
document.querySelector('[data-provider-close]').addEventListener('click', closeProviderSurface);
providerDialog.addEventListener('close', () => {
  document.querySelector('[data-provider-frame]').src = 'about:blank';
  providerReturnFocus?.focus();
  providerReturnFocus = null;
});
document
  .querySelector('[data-provider-details-close]')
  ?.addEventListener('click', closeProviderDetails);
document.querySelector('[data-provider-details-launch]')?.addEventListener('click', () => {
  if (selectedProviderDetails) {
    const selected = selectedProviderDetails;
    closeProviderDetails();
    launchEntry(selected.entry, selected.plan);
  }
});
document.querySelector('[data-provider-details-dialog]')?.addEventListener('close', () => {
  selectedProviderDetails = null;
});
document.querySelector('[data-action="resume"]').addEventListener('click', () => {
  if (state.recovery) {
    window.location.assign('../player/index.html');
    return;
  }
  if (!state.lastLaunch) {
    const offer = beginSession({ id: 'spartan-host', backendType: 'remote-play' });
    if (offer) window.location.assign('../player/index.html?backend=spartan-host');
    return;
  }
  const entry = resolveResumeEntry(state.lastLaunch, state.catalog);
  const plan = entry && state.adapters?.get(entry.id)?.resolve();
  if (!entry || !plan || plan.status === 'unsupported') {
    showToast('The last connection is no longer available in the current catalog.');
    return;
  }
  launchEntry(entry, plan);
});
document.querySelectorAll('[data-section]').forEach((button) =>
  button.addEventListener('click', () => {
    const route = resolveDashboardSection(button.dataset.section);
    if (!route) return;
    if (route.kind === 'navigate') {
      window.location.assign(route.href);
      return;
    }
    state.filter = route.filter;
    render();
  }),
);
renderResume();
renderConsoleMode();
updateReadinessStatus();
globalThis.spartanElectron?.onDeepLink?.(handleDeepLink);
loadCatalog();
window.addEventListener('online', updateReadinessStatus);
window.addEventListener('offline', updateReadinessStatus);
