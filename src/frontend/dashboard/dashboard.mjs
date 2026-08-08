import '../pwa/register.mjs';
import { createFrontendCatalog, validateCatalogManifest } from '../catalog.mjs';
import { createSessionManager } from '../session/session.mjs';
import { createCatalogAdapterRegistry } from '../adapters/adapters.mjs';
import { evaluateCatalog } from '../compatibility/harness.mjs';
import { collectCapabilities } from '../diagnostics/capabilities.mjs';
import { applyGlobalProviderPreferences, createProviderProfileStore } from '../providers/profiles.mjs';
import { createLaunchIntent, saveLaunchIntent } from '../launch/intent.mjs';
import { createLaunchHistoryStore } from '../launch/history.mjs';
import { resolveDashboardSection } from './routes.mjs';
import { resolveResumeEntry, resolveResumePresentation } from './resume.mjs';
import { createReadinessStatus } from '../readiness/status.mjs';
import { createWorkspaceStore } from '../workspaces/workspaces.mjs';
import { createFavoritesStore } from './library-state.mjs';
import { createCommunityProviderCatalogStore, mergeCommunityProviders } from '../providers/community-catalog.mjs';
import { createSettingsStore } from '../settings/profile.mjs';
import { launchExternalSurface } from '../launch/behavior.mjs';

const launchHistory = createLaunchHistoryStore();
const workspaceStore = createWorkspaceStore();
const communityCatalogStore = createCommunityProviderCatalogStore();
const settings = createSettingsStore().read();
let activeWorkspace = workspaceStore.active;
let favoritesStore = createFavoritesStore({workspaceId: activeWorkspace.id});
const requestedFilter = new URLSearchParams(globalThis.location?.search || '').get('filter');
const state = { catalog: [], adapters: null, compatibility: null, report: null, filter: ['all', 'cloud', 'emulator', 'favorites', 'recent'].includes(requestedFilter) ? requestedFilter : 'all', search: '', favorites: new Set(favoritesStore.list()), recent: new Set(launchHistory.list().map(record => record.backendId)), lastLaunch: launchHistory.latest(), providerProfiles: Object.fromEntries(createProviderProfileStore().list().map(profile => [profile.providerId, applyGlobalProviderPreferences(profile, settings)])) };
const cards = document.querySelector('[data-cards]');
const toast = document.querySelector('[data-toast]');
const sessionStatus = document.querySelector('[data-session-status]');
const statusPill = sessionStatus.closest('.status-pill');
const providerDialog = document.querySelector('[data-provider-dialog]');
const sessionManager = createSessionManager({idFactory: () => `ses-${crypto.randomUUID()}`});
let sessionStatusId = 'idle';
let toastTimer;
document.querySelector('.topbar')?.insertAdjacentHTML('beforeend', '<label class="workspace-picker" style="display:flex;align-items:center;gap:7px;color:#8d9aa7;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase"><span>Workspace</span><select data-workspace-select aria-label="Active workspace" style="min-width:118px;padding:8px 9px;border:1px solid #2a3540;border-radius:7px;background:#171e26;color:#e7edf3;font-size:11px;letter-spacing:0;text-transform:none"></select></label>');

function renderWorkspaceControl() { const control = document.querySelector('[data-workspace-select]'); if (!control) return; control.innerHTML = workspaceStore.list().map(workspace => `<option value="${escapeHtml(workspace.id)}" ${workspace.id === activeWorkspace.id ? 'selected' : ''}>${escapeHtml(workspace.name)}</option>`).join(''); control.title = `${activeWorkspace.name} workspace`; }
function saveFavorites() { favoritesStore.set([...state.favorites]); }
function showToast(message) { toast.textContent = message; toast.classList.add('is-visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600); }
function updateReadinessStatus() { const status = createReadinessStatus({catalogLoaded: state.catalog.length > 0, compatibility: state.compatibility, capabilityReport: state.report, online: globalThis.navigator?.onLine !== false, activeSession: sessionStatusId}); sessionStatus.textContent = status.label; statusPill.dataset.status = status.id; statusPill.title = status.detail; }
function setSessionStatus(status) { sessionStatusId = status; updateReadinessStatus(); }
function renderResume() {
  const presentation = resolveResumePresentation(state.lastLaunch); const title = document.querySelector('[data-resume-title]'); const copy = document.querySelector('[data-resume-copy]'); const button = document.querySelector('[data-action="resume"]');
  title.textContent = presentation.title; copy.textContent = presentation.copy; button.textContent = presentation.actionLabel;
}
function openProviderSurface(entry, plan) {
  const integration = plan.integration || {};
  document.querySelector('[data-provider-title]').textContent = entry.name;
  document.querySelector('[data-provider-detail]').textContent = `${integration.surfaces?.length ? integration.surfaces.join(' · ') : entry.kind} · ${integration.quality || 'balanced'} quality · ${integration.regionLabel || 'Automatic'} region`;
  document.querySelector('[data-provider-frame]').src = plan.url;
  const external = document.querySelector('[data-provider-external]'); external.href = plan.url;
  const notes = [...(integration.notes || []), ...(plan.readiness?.issues || []).map(issue => issue.message), ...(integration.requirements?.length ? [`Setup: ${integration.requirements.join(', ')}`] : []), 'Authentication and provider permissions remain on the official service.'];
  document.querySelector('[data-provider-notes]').textContent = notes.join(' ');
  if (typeof providerDialog.showModal === 'function') providerDialog.showModal(); else providerDialog.setAttribute('open', '');
}
function closeProviderSurface() { document.querySelector('[data-provider-frame]').src = 'about:blank'; if (typeof providerDialog.close === 'function' && providerDialog.open) providerDialog.close(); else providerDialog.removeAttribute('open'); }
function launchEntry(entry, plan) {
  state.recent.add(entry.id);
  state.lastLaunch = launchHistory.record({backendId: entry.id, backendType: entry.backendType, name: entry.name, mode: plan.mode, action: plan.action, at: new Date().toISOString()});
  renderResume();
  saveLaunchIntent(sessionStorage, createLaunchIntent({entry, plan, profileId: activeWorkspace.id, returnTo: './index.html'}));
  if (plan.readiness?.nextAction === 'run-diagnostics') { window.location.assign('../diagnostics/index.html'); return; }
  if (plan.readiness?.nextAction === 'choose-runtime' || plan.action === 'choose-runtime' || plan.action === 'configure-native-adapter') { window.location.assign('../emulation/index.html'); return; }
  if (plan.action === 'configure-host') { window.location.assign('../host/index.html'); return; }
  if (plan.action === 'embed-url') { openProviderSurface(entry, plan); showToast(`${entry.name}: official embed opened.`); return; }
  if (plan.action === 'open-url' || plan.action === 'configure-api') { try { const handoff = launchExternalSurface(plan.url, {behavior: settings['gaming.launchBehavior'], open: window.open.bind(window), assign: window.location.assign.bind(window.location)}); showToast(`${entry.name}: ${handoff.mode === 'current-workspace' ? 'official service opened here' : 'official service opened'}.`); } catch (error) { showToast(error.message); } return; }
  const offer = beginSession({...entry, adapterMode: plan.mode}); if (offer) showToast(`${entry.name}: ${plan.action.replaceAll('-', ' ')}.`);
}
function beginSession(backend) {
  if (sessionManager.state !== 'idle' && sessionManager.state !== 'closed' && sessionManager.state !== 'error') { showToast('A session is already negotiating. Close it before launching another.'); return null; }
  if (sessionManager.state === 'closed' || sessionManager.state === 'error') sessionManager.reset();
  const offer = sessionManager.start({backend}); setSessionStatus('connecting'); return offer;
}
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])); }
function visibleEntries() {
  const query = state.search.toLowerCase().trim();
  return state.catalog.filter(entry => {
    const matchesType = state.filter === 'all' || (state.filter === 'emulator' ? entry.backendType === 'emulator' : state.filter === 'cloud' ? entry.backendType === 'provider' : state.filter === 'favorites' ? state.favorites.has(entry.id) : state.recent.has(entry.id));
    const haystack = `${entry.name} ${entry.description || ''} ${(entry.systems || []).join(' ')}`.toLowerCase();
    return matchesType && (!query || haystack.includes(query));
  });
}
function render() {
  renderWorkspaceControl();
  const entries = visibleEntries();
  document.querySelector('[data-result-count]').textContent = `${entries.length} connection${entries.length === 1 ? '' : 's'}`;
  cards.innerHTML = entries.length ? entries.map(entry => {
    const favorite = state.favorites.has(entry.id);
    const tags = [...(state.recent.has(entry.id) ? ['Recent'] : []), ...(entry.systems || []).slice(0, 2), ...(entry.capabilities || []).slice(0, 1)];
    const summary = entry.description || (entry.requirements?.length ? entry.requirements.join(' · ') : entry.systems?.length ? entry.systems.join(' · ') : 'Ready to connect');
    const plan = state.adapters?.get(entry.id)?.resolve(); const readiness = {ready: 'Ready', 'configuration-required': 'Setup required', 'browser-capability-missing': 'Capability missing', 'native-adapter-required': 'Native adapter'}[plan?.readiness?.status] || 'Checking…'; const actionLabel = plan?.readiness?.nextAction === 'run-diagnostics' ? 'Run diagnostics' : plan?.readiness?.nextAction === 'choose-runtime' ? 'Choose runtime' : entry.backendType === 'provider' ? 'Open service' : 'Configure';
    return `<article class="card"><div class="card-top"><span class="card-type">${escapeHtml(entry.backendType === 'emulator' ? 'Emulation' : entry.kind)}</span><button class="favorite ${favorite ? 'is-favorite' : ''}" data-favorite="${escapeHtml(entry.id)}" aria-label="${favorite ? 'Remove' : 'Add'} ${escapeHtml(entry.name)} ${favorite ? 'from' : 'to'} favorites">★</button></div><h3>${escapeHtml(entry.name)}</h3><p>${escapeHtml(summary)}</p><div class="chips">${tags.map(tag => `<span class="chip">${escapeHtml(tag)}</span>`).join('')}</div><div class="card-actions"><button class="launch" data-launch="${escapeHtml(entry.id)}">${actionLabel}</button><span class="details">${escapeHtml(entry.supportLevel || 'Community')} · ${readiness}</span></div></article>`;
  }).join('') : '<div class="empty">No connections match this view. Try another filter or search term.</div>';
}
async function loadCatalog() {
  try {
    const [providers, emulators] = await Promise.all([fetch('../../../providers/catalog.json').then(response => response.json()), fetch('../../../emulators/catalog.json').then(response => response.json())]);
    validateCatalogManifest(providers, 'provider');
    validateCatalogManifest(emulators, 'emulator');
    state.catalog = createFrontendCatalog({ providers: mergeCommunityProviders({providers: providers.providers, community: communityCatalogStore.list()}), emulators: emulators.projects }).entries;
    state.adapters = createCatalogAdapterRegistry(state.catalog, {providerProfiles: state.providerProfiles, report: () => state.report || {}});
    updateReadinessStatus();
    render();
    collectCapabilities().then(report => { state.report = report; state.compatibility = evaluateCatalog(state.catalog, report); updateReadinessStatus(); render(); }).catch(() => { state.report = {}; state.compatibility = evaluateCatalog(state.catalog, state.report); updateReadinessStatus(); render(); });
  } catch (error) { cards.innerHTML = '<div class="empty">The library could not load. Check the catalog files and try again.</div>'; console.error(error); }
}
document.querySelector('[data-search]').addEventListener('input', event => { state.search = event.target.value; render(); });
document.querySelector('[data-workspace-select]')?.addEventListener('change', event => { activeWorkspace = workspaceStore.setActive(event.target.value); favoritesStore = createFavoritesStore({workspaceId: activeWorkspace.id}); state.favorites = new Set(favoritesStore.list()); render(); showToast(`Using ${activeWorkspace.name} workspace`); });
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { state.filter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach(item => item.classList.toggle('is-active', item === button)); render(); }));
document.querySelectorAll('[data-filter]').forEach(button => button.classList.toggle('is-active', button.dataset.filter === state.filter));
document.addEventListener('click', event => {
  const favoriteButton = event.target.closest('[data-favorite]');
  if (favoriteButton) { const id = favoriteButton.dataset.favorite; const next = favoritesStore.toggle(id); state.favorites = new Set(next); render(); showToast(state.favorites.has(id) ? `Added to ${activeWorkspace.name} favorites` : `Removed from ${activeWorkspace.name} favorites`); return; }
  const launchButton = event.target.closest('[data-launch]');
  if (launchButton) { const entry = state.catalog.find(item => item.id === launchButton.dataset.launch); if (!entry) return; const plan = state.adapters?.get(entry.id)?.resolve(); if (!plan || plan.status === 'unsupported') { showToast(`${entry.name}: no supported integration mode is available.`); return; } launchEntry(entry, plan); }
});
document.querySelector('[data-provider-close]').addEventListener('click', closeProviderSurface);
providerDialog.addEventListener('close', () => { document.querySelector('[data-provider-frame]').src = 'about:blank'; });
document.querySelector('[data-action="resume"]').addEventListener('click', () => {
  if (!state.lastLaunch) { const offer = beginSession({id: 'spartan-host', backendType: 'remote-play'}); if (offer) window.location.assign('../player/index.html?backend=spartan-host'); return; }
  const entry = resolveResumeEntry(state.lastLaunch, state.catalog); const plan = entry && state.adapters?.get(entry.id)?.resolve();
  if (!entry || !plan || plan.status === 'unsupported') { showToast('The last connection is no longer available in the current catalog.'); return; }
  launchEntry(entry, plan);
});
document.querySelectorAll('[data-section]').forEach(button => button.addEventListener('click', () => {
  const route = resolveDashboardSection(button.dataset.section); if (!route) return;
  if (route.kind === 'navigate') { window.location.assign(route.href); return; }
  state.filter = route.filter; document.querySelectorAll('[data-filter]').forEach(item => item.classList.toggle('is-active', item.dataset.filter === state.filter)); render();
}));
renderResume();
updateReadinessStatus();
loadCatalog();
window.addEventListener('online', updateReadinessStatus);
window.addEventListener('offline', updateReadinessStatus);
