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
import { createFavoritesStore } from './library-state.mjs';
import {
  createCommunityProviderCatalogStore,
  mergeCommunityProviders,
} from '../providers/community-catalog.mjs';
import { createSettingsStore } from '../settings/profile.mjs';
import { launchExternalSurface } from '../launch/behavior.mjs';
import { checkProviderCatalog } from '../providers/catalog-health.mjs';
import { resolveProviderStartupPolicy } from '../providers/startup-policy.mjs';
import {
  clearSessionRecoveryHandoff,
  readSessionRecoveryHandoff,
} from '../session/recovery-handoff.mjs';
import { resolveStartupRoute } from '../startup/route.mjs';
import { createActiveProfileStorage } from '../profiles/storage.mjs';
import { createProviderDetailsModel } from '../providers/details.mjs';
import { nextConsoleMode, resolveConsoleMode } from '../platform/console-mode.mjs';
import { resolveElectronRuntimeSettings } from '../settings/electron-runtime.mjs';

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
const requestedFilter = new URLSearchParams(globalThis.location?.search || '').get('filter');
const state = {
  catalog: [],
  adapters: null,
  compatibility: null,
  report: null,
  providerHealth: new Map(),
  filter: ['all', 'cloud', 'watch', 'browser', 'emulator', 'favorites', 'recent'].includes(
    requestedFilter,
  )
    ? requestedFilter
    : 'all',
  search: '',
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
  .querySelector('.main-nav')
  ?.insertAdjacentHTML(
    'beforeend',
    '<button class="nav-item" data-section="browser">▣ <span>Browser games</span></button>',
  );
const cards = document.querySelector('[data-cards]');
const toast = document.querySelector('[data-toast]');
const sessionStatus = document.querySelector('[data-session-status]');
const statusPill = sessionStatus.closest('.status-pill');
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
  settingsStore.save({ ...settings, 'appearance.consoleMode': consoleMode });
  renderConsoleMode();
  showToast(consoleMode ? 'Console Mode enabled' : 'Console Mode disabled');
});
let sessionStatusId = 'idle';
let toastTimer;
let selectedProviderDetails = null;
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
  const integration = plan.integration || {};
  if (
    globalThis.spartanElectron?.isElectron &&
    typeof globalThis.spartanElectron.openProvider === 'function'
  ) {
    globalThis.spartanElectron
      .openProvider(plan.url, entry.name, {
        profileId: profileStorage.profileId,
        isolateAccounts: settings['providers.isolateAccounts'] !== false,
        autoDetect: settings['providers.autoDetect'] !== false,
      })
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
    `${model.kind} · Support ${model.supportLevel} · ${model.readinessStatus.replaceAll('-', ' ')}`;
  content.innerHTML = `<div class="details-summary"><p>${escapeHtml(model.readinessReason)}</p><div class="details-facts"><span><strong>Mode</strong>${escapeHtml(model.mode || 'Unavailable')}</span><span><strong>Quality</strong>${escapeHtml(model.quality)}</span><span><strong>Region</strong>${escapeHtml(model.regionLabel)}</span><span><strong>Controller</strong>${escapeHtml(model.controllerProfile)}</span></div></div><div class="details-columns"><section><h3>Supported surfaces</h3><p>${escapeHtml(model.surfaces.join(' · ') || 'Official web experience')}</p><h3>Capabilities</h3><p>${escapeHtml(model.capabilities.join(' · ') || 'Provider-defined')}</p></section><section><h3>Setup requirements</h3><p>${escapeHtml(model.requirements.join(' · ') || 'None listed')}</p><h3>Readiness notes</h3><p>${escapeHtml([...model.troubleshooting, ...model.notes, ...(model.blocking.length ? [`Blocking: ${model.blocking.join(', ')}`] : [])].join(' ') || 'No additional notes.')}</p></section></div><p class="details-privacy">Authentication, subscriptions, provider permissions, and account sessions remain on the official service. Spartan Gaming stores no provider tokens in this flow.</p>`;
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
  if (offer) showToast(`${entry.name}: ${plan.action.replaceAll('-', ' ')}.`);
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
  const query = state.search.toLowerCase().trim();
  return state.catalog.filter((entry) => {
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
                : state.recent.has(entry.id));
    const haystack =
      `${entry.name} ${entry.description || ''} ${(entry.systems || []).join(' ')}`.toLowerCase();
    return matchesType && (!query || haystack.includes(query));
  });
}
function render() {
  renderWorkspaceControl();
  const entries = visibleEntries();
  document.querySelector('[data-result-count]').textContent =
    `${entries.length} connection${entries.length === 1 ? '' : 's'}`;
  cards.innerHTML = entries.length
    ? entries
        .map((entry) => {
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
                  : entry.backendType === 'game'
                    ? 'Play in browser'
                    : 'Configure';
          return `<article class="card"><div class="card-top"><span class="card-type">${escapeHtml(entry.backendType === 'emulator' ? 'Emulation' : entry.backendType === 'game' ? 'Browser game' : entry.kind)}</span><button class="favorite ${favorite ? 'is-favorite' : ''}" data-favorite="${escapeHtml(entry.id)}" aria-label="${favorite ? 'Remove' : 'Add'} ${escapeHtml(entry.name)} ${favorite ? 'from' : 'to'} favorites">★</button></div><h3>${escapeHtml(entry.name)}</h3><p>${escapeHtml(summary)}</p><div class="chips">${tags.map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join('')}</div><div class="card-actions">${entry.backendType === 'provider' ? `<button class="details-button" data-details="${escapeHtml(entry.id)}">Details</button>` : ''}<button class="launch" data-launch="${escapeHtml(entry.id)}">${actionLabel}</button><span class="details">${escapeHtml(entry.supportLevel || 'Community')} · ${readiness}${entry.backendType === 'provider' ? providerHealthLabel(entry) : ''}</span></div></article>`;
        })
        .join('')
    : '<div class="empty">No connections match this view. Try another filter or search term.</div>';
}
async function loadCatalog() {
  try {
    const [providers, emulators, games] = await Promise.all([
      fetch('../../../providers/catalog.json').then((response) => response.json()),
      fetch('../../../emulators/catalog.json').then((response) => response.json()),
      fetch('../../../games/catalog.json').then((response) => response.json()),
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
document.querySelector('[data-search]').addEventListener('input', (event) => {
  state.search = event.target.value;
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
    document
      .querySelectorAll('[data-filter]')
      .forEach((item) => item.classList.toggle('is-active', item === button));
    render();
  }),
);
document
  .querySelectorAll('[data-filter]')
  .forEach((button) =>
    button.classList.toggle('is-active', button.dataset.filter === state.filter),
  );
document.addEventListener('click', (event) => {
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
    const entry = state.catalog.find((item) => item.id === launchButton.dataset.launch);
    if (!entry) return;
    const plan = state.adapters?.get(entry.id)?.resolve();
    if (!plan || plan.status === 'unsupported') {
      showToast(`${entry.name}: no supported integration mode is available.`);
      return;
    }
    launchEntry(entry, plan);
  }
});
document.querySelector('[data-provider-close]').addEventListener('click', closeProviderSurface);
providerDialog.addEventListener('close', () => {
  document.querySelector('[data-provider-frame]').src = 'about:blank';
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
    document
      .querySelectorAll('[data-filter]')
      .forEach((item) => item.classList.toggle('is-active', item.dataset.filter === state.filter));
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
