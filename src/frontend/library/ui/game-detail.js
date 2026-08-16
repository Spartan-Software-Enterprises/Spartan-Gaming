import { createLibraryStore } from '../library/store.mjs';
import { createMetadataProvider } from '../library/providers/index.mjs';

const store = createLibraryStore({
  metadataProviders: createMetadataProvider({
    igdb: { enabled: false, clientId: '', clientSecret: '' },
    rawg: { enabled: false, apiKey: '' },
    hasheous: { enabled: true, apiKey: '' },
    playmatch: { enabled: true, apiKey: '' },
    steamgriddb: { enabled: false, apiKey: '' },
  }),
});

const urlParams = new URLSearchParams(window.location.search);
const gameId = urlParams.get('id');

const elements = {
  pageTitle: document.querySelector('[data-page-title]'),
  heroCover: document.querySelector('[data-hero-cover]'),
  heroTitle: document.querySelector('[data-hero-title]'),
  heroMeta: document.querySelector('[data-hero-meta]'),
  heroLaunch: document.querySelector('[data-hero-launch]'),
  heroFavorite: document.querySelector('[data-hero-favorite]'),
  tabs: document.querySelector('[data-tabs]'),
  tabPanels: document.querySelectorAll('[data-tab-content]'),
  description: document.querySelector('[data-description]'),
  details: document.querySelector('[data-details]'),
  platforms: document.querySelector('[data-platforms]'),
  genres: document.querySelector('[data-genres]'),
  sources: document.querySelector('[data-sources]'),
  links: document.querySelector('[data-links]'),
  screenshots: document.querySelector('[data-screenshots]'),
  videos: document.querySelector('[data-videos]'),
  achievements: document.querySelector('[data-achievements]'),
  metadataView: document.querySelector('[data-metadata-view]'),
};

async function init() {
  await store.init();

  if (!gameId) {
    showError('No game ID specified');
    return;
  }

  bindTabs();
  await loadGame();
}

function bindTabs() {
  const tabButtons = elements.tabs.querySelectorAll('button');
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      tabButtons.forEach((b) => b.classList.toggle('active', b === btn));
      elements.tabPanels.forEach((p) => p.classList.toggle('active', p.dataset.tabContent === tab));
    });
  });

  elements.heroLaunch.addEventListener('click', () => launchGame());
  elements.heroFavorite.addEventListener('click', () => toggleFavorite());
}

async function loadGame() {
  const game = await store.getGame(gameId);
  if (!game) {
    showError('Game not found');
    return;
  }

  document.title = `${game.title} — Spartan Gaming`;
  if (elements.pageTitle) elements.pageTitle.textContent = `${game.title} — Spartan Gaming`;

  elements.heroCover.src =
    game.coverArt ?? `data:image/svg+xml,${encodeURIComponent(placeholderSvg(game.title))}`;
  elements.heroCover.alt = game.title;
  elements.heroTitle.textContent = game.title;
  elements.heroMeta.textContent = [
    game.platforms?.[0],
    game.releaseDate?.split('-')[0],
    game.genres?.[0],
  ]
    .filter(Boolean)
    .join(' • ');

  elements.heroFavorite.classList.toggle('active', game.favorite);
  elements.heroFavorite.textContent = game.favorite ? '★ Favorited' : '★ Favorite';

  elements.description.textContent = game.description ?? 'No description available.';

  const details = [];
  if (game.developer) details.push(['Developer', game.developer]);
  if (game.publisher) details.push(['Publisher', game.publisher]);
  if (game.releaseDate) details.push(['Release Date', game.releaseDate]);
  if (game.rating) details.push(['Rating', `${game.rating}/100`]);
  if (game.playtime) details.push(['Playtime', formatPlaytime(game.playtime)]);
  if (game.filePath) details.push(['File', game.filePath.split('/').pop()]);
  if (game.fileSize) details.push(['Size', formatBytes(game.fileSize)]);
  if (game.hashes) {
    for (const [algo, hash] of Object.entries(game.hashes)) {
      details.push([algo.toUpperCase(), hash]);
    }
  }
  elements.details.innerHTML = details
    .map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`)
    .join('');

  if (game.platforms?.length) {
    elements.platforms.innerHTML = game.platforms
      .map((p) => `<span class="tag">${escapeHtml(p)}</span>`)
      .join(' ');
  }

  if (game.genres?.length) {
    elements.genres.innerHTML = game.genres
      .map((g) => `<span class="tag">${escapeHtml(g)}</span>`)
      .join(' ');
  }

  if (game.metadata) {
    elements.sources.innerHTML = Object.entries(game.metadata)
      .map(
        ([source, data]) =>
          `<div class="source-detail">
        <h4>${source.toUpperCase()}</h4>
        <pre>${JSON.stringify(data, null, 2)}</pre>
      </div>`,
      )
      .join('');
  }

  if (game.screenshots?.length) {
    elements.screenshots.innerHTML = game.screenshots
      .map((url) => `<img src="${escapeHtml(url)}" alt="Screenshot" loading="lazy" />`)
      .join('');
  }

  if (game.videos?.length) {
    elements.videos.innerHTML = game.videos
      .map(
        (url) =>
          `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="video-link">
        <span class="video-thumb">▶</span>
        <span>${escapeHtml(new URL(url).hostname)}</span>
      </a>`,
      )
      .join('');
  }

  if (game.metadata) {
    elements.metadataView.innerHTML = Object.entries(game.metadata)
      .map(
        ([source, data]) =>
          `<div class="metadata-source">
        <h4>${source.toUpperCase()}</h4>
        <pre>${JSON.stringify(data, null, 2)}</pre>
      </div>`,
      )
      .join('');
  }

  if (game.website) {
    elements.links.innerHTML = `<a href="${escapeHtml(game.website)}" target="_blank" rel="noopener">${escapeHtml(game.website)}</a>`;
  }
}

async function launchGame() {
  const game = await store.getGame(gameId);
  if (!game || !game.filePath) return;
  window.location.href = `../emulation/index.html?launch=${encodeURIComponent(game.id)}&file=${encodeURIComponent(game.filePath)}`;
}

async function toggleFavorite() {
  const game = await store.getGame(gameId);
  if (!game) return;
  await store.updateGame(gameId, { favorite: !game.favorite });
  elements.heroFavorite.classList.toggle('active');
  elements.heroFavorite.textContent = !game.favorite ? '★ Favorited' : '★ Favorite';
}

function showError(message) {
  document.body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:16px;padding:24px;text-align:center;">
      <h1>Error</h1>
      <p>${escapeHtml(message)}</p>
      <a href="../library/index.html" class="primary">Back to Library</a>
    </div>
  `;
}

function placeholderSvg(title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><rect fill="#1a1a2e" width="300" height="400"/><text x="150" y="200" text-anchor="middle" fill="#666" font-family="system-ui" font-size="14">${escapeHtml(title).slice(0, 30)}</text></svg>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

function formatPlaytime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

init().catch(console.error);
