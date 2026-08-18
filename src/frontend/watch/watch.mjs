import '../pwa/register.mjs';
import { createProviderIntegration } from '../providers/integration.mjs';
import { STREAM_SERVICE_IDS } from '../social/streaming.mjs';
import { bindPrimaryNavigation } from '../primary-navigation.mjs';
import { createSettingsStore } from '../settings/profile.mjs';

const settingsStore = createSettingsStore();
const watchSettings = settingsStore.read();
document.head.insertAdjacentHTML(
  'beforeend',
  '<link rel="stylesheet" href="../dashboard/console-mode.css">',
);
document.body.classList.add('console-mode');

function escapeHtml(value) {
  return String(value).replace(
    /[&<>'"]/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character],
  );
}

function showToast(message) {
  const toast = document.querySelector('[data-toast]');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

function getFilteredServices(providerEntries = [], filter = 'all') {
  const services = providerEntries.filter((entry) => STREAM_SERVICE_IDS.includes(entry.id));
  if (filter === 'live') {
    return services.filter((entry) => entry.kind === 'live-streaming');
  }
  if (filter === 'social') {
    return services.filter((entry) => entry.kind === 'social-streaming');
  }
  return services;
}

function renderWatchPage(providerEntries = [], filter = 'all') {
  const cards = document.querySelector('[data-cards]');
  const resultCount = document.querySelector('[data-result-count]');
  if (!cards || !resultCount) return;

  const services = getFilteredServices(providerEntries, filter);
  resultCount.textContent = `${services.length} service${services.length === 1 ? '' : 's'}`;

  cards.innerHTML = services.length
    ? services
        .map((entry) => {
          const integration = createProviderIntegration(entry, {});
          const caps = integration.surfaces
            .map((s) => `<span class="chip">${escapeHtml(s)}</span>`)
            .join('');
          const authLabel =
            entry.id === 'steam-broadcasting'
              ? 'Steam OpenID'
              : entry.id === 'discord'
                ? 'OAuth'
                : 'Official';
          return `<article class="card"><div class="card-top"><span class="card-type">${escapeHtml(entry.kind)}</span><button class="favorite" data-favorite="${escapeHtml(entry.id)}" aria-label="Favorite ${escapeHtml(entry.name)}">★</button></div><h3>${escapeHtml(entry.name)}</h3><p>${escapeHtml(entry.description || 'Official streaming or social surface. Opens in an isolated provider view.')}</p><div class="chips">${caps}</div><div class="card-actions"><button class="launch" data-stream="${escapeHtml(entry.id)}">Open ${escapeHtml(entry.name)}</button><span class="details">${entry.secure !== false ? 'Secure' : 'Standard'} · ${authLabel}</span></div></article>`;
        })
        .join('')
    : '<div class="empty">No streaming services match this view.</div>';
}

function setupWatchPage(providerEntries = []) {
  let currentFilter = 'all';

  function applyFilter(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filters .filter').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.filter === filter);
    });
    renderWatchPage(providerEntries, filter);
  }

  document.querySelectorAll('.filters .filter').forEach((button) => {
    button.addEventListener('click', () => applyFilter(button.dataset.filter));
  });

  document.querySelector('[data-search]')?.addEventListener('input', (event) => {
    const query = event.target.value.toLowerCase().trim();
    const cards = document.querySelector('[data-cards]');
    if (!cards) return;

    const services = getFilteredServices(providerEntries, currentFilter).filter((entry) => {
      const haystack = `${entry.name} ${entry.description || ''}`.toLowerCase();
      return !query || haystack.includes(query);
    });

    document.querySelector('[data-result-count]').textContent =
      `${services.length} service${services.length === 1 ? '' : 's'}`;
    cards.innerHTML = services.length
      ? services
          .map((entry) => {
            const integration = createProviderIntegration(entry, {});
            const caps = integration.surfaces
              .map((s) => `<span class="chip">${escapeHtml(s)}</span>`)
              .join('');
            const authLabel =
              entry.id === 'steam-broadcasting'
                ? 'Steam OpenID'
                : entry.id === 'discord'
                  ? 'OAuth'
                  : 'Official';
            return `<article class="card"><div class="card-top"><span class="card-type">${escapeHtml(entry.kind)}</span><button class="favorite" data-favorite="${escapeHtml(entry.id)}" aria-label="Favorite ${escapeHtml(entry.name)}">★</button></div><h3>${escapeHtml(entry.name)}</h3><p>${escapeHtml(entry.description || 'Official streaming or social surface. Opens in an isolated provider view.')}</p><div class="chips">${caps}</div><div class="card-actions"><button class="launch" data-stream="${escapeHtml(entry.id)}">Open ${escapeHtml(entry.name)}</button><span class="details">${entry.secure !== false ? 'Secure' : 'Standard'} · ${authLabel}</span></div></article>`;
          })
          .join('')
      : '<div class="empty">No streaming services match this view.</div>';
  });

  document.addEventListener('click', (event) => {
    const streamButton = event.target.closest('[data-stream]');
    if (streamButton) {
      const entry = providerEntries.find((s) => s.id === streamButton.dataset.stream);
      if (entry) {
        const integration = createProviderIntegration(entry, {});
        if (integration.mode === 'provider-embed' && integration.embedUrl) {
          const dialog = document.querySelector('[data-stream-dialog]');
          const title = document.querySelector('[data-stream-title]');
          const detail = document.querySelector('[data-stream-detail]');
          const body = document.querySelector('[data-stream-body]');
          if (title) title.textContent = entry.name;
          if (detail) detail.textContent = entry.description || 'Official embedded surface.';
          if (body)
            body.innerHTML = `<iframe src="${escapeHtml(integration.embedUrl)}" style="width:100%;height:60vh;border:0;background:#000" allow="autoplay; encrypted-media; fullscreen" sandbox="allow-scripts allow-same-origin allow-presentation"></iframe>`;
          if (typeof dialog?.showModal === 'function') dialog.showModal();
          else dialog?.setAttribute('open', '');
        } else {
          window.open(entry.url, '_blank', 'noopener,noreferrer');
          showToast(`Opening ${entry.name}...`);
        }
      }
      return;
    }
    const closeButton = event.target.closest('[data-stream-close]');
    if (closeButton) {
      const dialog = document.querySelector('[data-stream-dialog]');
      if (typeof dialog.close === 'function') dialog.close();
      else dialog?.removeAttribute('open');
      return;
    }
  });

  renderWatchPage(providerEntries, currentFilter);
}

if (typeof document !== 'undefined') {
  setupWatchPage(window.__SPARTAN_CATALOG__?.entries || []);
}
