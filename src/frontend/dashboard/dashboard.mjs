import '../pwa/register.mjs';
import { createFrontendCatalog, validateCatalogManifest } from '../catalog.mjs';
import { createSessionManager } from '../session/session.mjs';
import { createCatalogAdapterRegistry } from '../adapters/adapters.mjs';
import { createControllerNavigator } from '../input/navigation.mjs';
import { evaluateCatalog } from '../compatibility/harness.mjs';
import { collectCapabilities } from '../diagnostics/capabilities.mjs';
import { createProviderProfileStore } from '../providers/profiles.mjs';
import { createLaunchIntent, saveLaunchIntent } from '../launch/intent.mjs';
import { createLaunchHistoryStore } from '../launch/history.mjs';
import { resolveDashboardSection } from './routes.mjs';
import { resolveResumeEntry, resolveResumePresentation } from './resume.mjs';

const FAVORITES_KEY = 'spartan-gaming.favorites.v1';
const launchHistory = createLaunchHistoryStore();
const requestedFilter = new URLSearchParams(globalThis.location?.search || '').get('filter');
const state = { catalog: [], adapters: null, compatibility: null, filter: ['all', 'cloud', 'emulator', 'favorites', 'recent'].includes(requestedFilter) ? requestedFilter : 'all', search: '', favorites: new Set(loadFavorites()), recent: new Set(launchHistory.list().map(record => record.backendId)), lastLaunch: launchHistory.latest(), providerProfiles: Object.fromEntries(createProviderProfileStore().list().map(profile => [profile.providerId, profile])) };
const cards = document.querySelector('[data-cards]');
const toast = document.querySelector('[data-toast]');
const sessionStatus = document.querySelector('[data-session-status]');
const providerDialog = document.querySelector('[data-provider-dialog]');
const sessionManager = createSessionManager({idFactory: () => `ses-${crypto.randomUUID()}`});
let toastTimer;
const controllerNavigator = createControllerNavigator({root: document});

function loadFavorites() { try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'); } catch { return []; } }
function saveFavorites() { localStorage.setItem(FAVORITES_KEY, JSON.stringify([...state.favorites])); }
function showToast(message) { toast.textContent = message; toast.classList.add('is-visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600); }
function setSessionStatus(message) { sessionStatus.textContent = message; }
function renderResume() {
  const presentation = resolveResumePresentation(state.lastLaunch); const title = document.querySelector('[data-resume-title]'); const copy = document.querySelector('[data-resume-copy]'); const button = document.querySelector('[data-action="resume"]');
  title.textContent = presentation.title; copy.textContent = presentation.copy; button.textContent = presentation.actionLabel;
}
function openProviderSurface(entry, plan) {
  const integration = plan.integration || {};
  document.querySelector('[data-provider-title]').textContent = entry.name;
  document.querySelector('[data-provider-detail]').textContent = `${integration.surfaces?.length ? integration.surfaces.join(' · ') : entry.kind} · ${integration.quality || 'balanced'} quality preference`;
  document.querySelector('[data-provider-frame]').src = plan.url;
  const external = document.querySelector('[data-provider-external]'); external.href = plan.url;
  const notes = [...(integration.notes || []), ...(integration.requirements?.length ? [`Setup: ${integration.requirements.join(', ')}`] : []), 'Authentication and provider permissions remain on the official service.'];
  document.querySelector('[data-provider-notes]').textContent = notes.join(' ');
  if (typeof providerDialog.showModal === 'function') providerDialog.showModal(); else providerDialog.setAttribute('open', '');
}
function closeProviderSurface() { document.querySelector('[data-provider-frame]').src = 'about:blank'; if (typeof providerDialog.close === 'function' && providerDialog.open) providerDialog.close(); else providerDialog.removeAttribute('open'); }
function launchEntry(entry, plan) {
  state.recent.add(entry.id);
  state.lastLaunch = launchHistory.record({backendId: entry.id, backendType: entry.backendType, name: entry.name, mode: plan.mode, action: plan.action, at: new Date().toISOString()});
  renderResume();
  saveLaunchIntent(sessionStorage, createLaunchIntent({entry, plan, returnTo: './index.html'}));
  if (plan.action === 'choose-runtime') { window.location.assign('../emulation/index.html'); return; }
  if (plan.action === 'configure-host') { window.location.assign('../host/index.html'); return; }
  if (plan.action === 'embed-url') { openProviderSurface(entry, plan); showToast(`${entry.name}: official embed opened.`); return; }
  if (plan.action === 'open-url' || plan.action === 'configure-api') { window.open(plan.url, '_blank', 'noopener'); showToast(`${entry.name}: ${plan.action === 'open-url' ? 'official service opened' : 'official API surface opened'}.`); return; }
  const offer = beginSession({...entry, adapterMode: plan.mode}); if (offer) showToast(`${entry.name}: ${plan.action.replaceAll('-', ' ')}.`);
}
function beginSession(backend) {
  if (sessionManager.state !== 'idle' && sessionManager.state !== 'closed' && sessionManager.state !== 'error') { showToast('A session is already negotiating. Close it before launching another.'); return null; }
  if (sessionManager.state === 'closed' || sessionManager.state === 'error') sessionManager.reset();
  const offer = sessionManager.start({backend}); setSessionStatus('Session negotiating'); return offer;
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
  const entries = visibleEntries();
  document.querySelector('[data-result-count]').textContent = `${entries.length} connection${entries.length === 1 ? '' : 's'}`;
  cards.innerHTML = entries.length ? entries.map(entry => {
    const favorite = state.favorites.has(entry.id);
    const tags = [...(state.recent.has(entry.id) ? ['Recent'] : []), ...(entry.systems || []).slice(0, 2), ...(entry.capabilities || []).slice(0, 1)];
    const summary = entry.description || (entry.requirements?.length ? entry.requirements.join(' · ') : entry.systems?.length ? entry.systems.join(' · ') : 'Ready to connect');
    const compatibility = state.compatibility?.get(entry.id); const readiness = {ready: 'Browser ready', 'configuration-required': 'Setup required', 'browser-capability-missing': 'Capability missing', 'native-adapter-required': 'Native adapter'}[compatibility?.status] || 'Checking…';
    return `<article class="card"><div class="card-top"><span class="card-type">${escapeHtml(entry.backendType === 'emulator' ? 'Emulation' : entry.kind)}</span><button class="favorite ${favorite ? 'is-favorite' : ''}" data-favorite="${escapeHtml(entry.id)}" aria-label="${favorite ? 'Remove' : 'Add'} ${escapeHtml(entry.name)} ${favorite ? 'from' : 'to'} favorites">★</button></div><h3>${escapeHtml(entry.name)}</h3><p>${escapeHtml(summary)}</p><div class="chips">${tags.map(tag => `<span class="chip">${escapeHtml(tag)}</span>`).join('')}</div><div class="card-actions"><button class="launch" data-launch="${escapeHtml(entry.id)}">${entry.backendType === 'provider' ? 'Open service' : 'Configure'}</button><span class="details">${escapeHtml(entry.supportLevel || 'Community')} · ${readiness}</span></div></article>`;
  }).join('') : '<div class="empty">No connections match this view. Try another filter or search term.</div>';
}
async function loadCatalog() {
  try {
    const [providers, emulators] = await Promise.all([fetch('../../../providers/catalog.json').then(response => response.json()), fetch('../../../emulators/catalog.json').then(response => response.json())]);
    validateCatalogManifest(providers, 'provider');
    validateCatalogManifest(emulators, 'emulator');
    state.catalog = createFrontendCatalog({ providers: providers.providers, emulators: emulators.projects }).entries;
    state.adapters = createCatalogAdapterRegistry(state.catalog, {providerProfiles: state.providerProfiles});
    render();
    collectCapabilities().then(report => { state.compatibility = evaluateCatalog(state.catalog, report); render(); }).catch(() => {});
  } catch (error) { cards.innerHTML = '<div class="empty">The library could not load. Check the catalog files and try again.</div>'; console.error(error); }
}
document.querySelector('[data-search]').addEventListener('input', event => { state.search = event.target.value; render(); });
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { state.filter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach(item => item.classList.toggle('is-active', item === button)); render(); }));
document.querySelectorAll('[data-filter]').forEach(button => button.classList.toggle('is-active', button.dataset.filter === state.filter));
document.addEventListener('click', event => {
  const favoriteButton = event.target.closest('[data-favorite]');
  if (favoriteButton) { const id = favoriteButton.dataset.favorite; state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id); saveFavorites(); render(); showToast(state.favorites.has(id) ? 'Added to favorites' : 'Removed from favorites'); return; }
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
loadCatalog();
controllerNavigator.start();
