import '../pwa/register.mjs';
import { createProviderIntegration } from '../providers/integration.mjs';

export const STREAM_SERVICE_IDS = Object.freeze([
  'twitch',
  'youtube-live',
  'kick',
  'steam-broadcasting',
  'discord',
]);

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

export function renderStreamServices(providerEntries = []) {
  const cards = document.querySelector('[data-cards]');
  if (!cards) return;

  const services = providerEntries.filter((entry) => STREAM_SERVICE_IDS.includes(entry.id));
  document.querySelector('[data-result-count]').textContent =
    `${services.length} service${services.length === 1 ? '' : 's'}`;

  cards.innerHTML = services
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
    .join('');
}

export function setupStreamServices(providerEntries = []) {
  document.addEventListener('click', (event) => {
    const streamButton = event.target.closest('[data-stream]');
    if (streamButton) {
      const entry = providerEntries.find((s) => s.id === streamButton.dataset.stream);
      if (entry) {
        const integration = createProviderIntegration(entry, {});
        if (integration.mode === 'provider-embed' && integration.embedUrl) {
          const dialog = document.querySelector('[data-social-dialog]');
          const title = document.querySelector('[data-social-title]');
          const detail = document.querySelector('[data-social-detail]');
          const body = document.querySelector('[data-social-body]');
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
  });

  renderStreamServices(providerEntries);
}
