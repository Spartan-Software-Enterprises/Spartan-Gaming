import { createLibraryStore } from '../store.mjs';
import { createMetadataProvider } from '../providers/index.mjs';

const store = createLibraryStore({
  metadataProviders: Object.values(
    createMetadataProvider({
      igdb: { enabled: false, clientId: '', clientSecret: '' },
      rawg: { enabled: false, apiKey: '' },
      hasheous: { enabled: true, apiKey: '' },
      playmatch: { enabled: true, apiKey: '' },
      steamgriddb: { enabled: false, apiKey: '' },
    }),
  ),
});

let currentView = 'grid';
let currentPage = 1;
const PAGE_SIZE = 48;
let currentFilter = { collection: 'all' };
let selectedGameId = null;

const elements = {
  search: document.querySelector('[data-search]'),
  filterPlatform: document.querySelector('[data-filter-platform]'),
  filterGenre: document.querySelector('[data-filter-genre]'),
  sort: document.querySelector('[data-sort]'),
  viewGrid: document.querySelector('[data-view-grid]'),
  viewList: document.querySelector('[data-view-list]'),
  addGame: document.querySelector('[data-add-game]'),
  gameGrid: document.querySelector('[data-game-grid]'),
  pagination: document.querySelector('[data-pagination]'),
  pagePrev: document.querySelector('[data-page-prev]'),
  pageNext: document.querySelector('[data-page-next]'),
  pageInfo: document.querySelector('[data-page-info]'),
  collections: document.querySelector('[data-collections]'),
  customCollections: document.querySelector('[data-custom-collections]'),
  counts: {
    all: document.querySelector('[data-count-all]'),
    fav: document.querySelector('[data-count-fav]'),
    recent: document.querySelector('[data-count-recent]'),
    nometa: document.querySelector('[data-count-nometa]'),
  },
  detail: document.querySelector('[data-detail]'),
  detailBack: document.querySelector('[data-detail-back]'),
  detailTitle: document.querySelector('[data-detail-title]'),
  detailMeta: document.querySelector('[data-detail-meta]'),
  detailCover: document.querySelector('[data-detail-cover]'),
  detailDescription: document.querySelector('[data-detail-description]'),
  detailDetails: document.querySelector('[data-detail-details]'),
  detailScreenshots: document.querySelector('[data-detail-screenshots]'),
  detailSources: document.querySelector('[data-detail-sources]'),
  detailLaunch: document.querySelector('[data-detail-launch]'),
  detailFavorite: document.querySelector('[data-detail-favorite]'),
  detailEdit: document.querySelector('[data-detail-edit]'),
};

const templates = {
  grid: document.querySelector('#game-card-grid'),
  list: document.querySelector('#game-card-list'),
};

async function init() {
  await store.init();
  bindEvents();
  await refreshCounts();
  await renderGames();
  await populateFilters();
}

function bindEvents() {
  elements.search.addEventListener(
    'input',
    debounce(() => {
      currentPage = 1;
      renderGames();
    }, 300),
  );

  elements.filterPlatform.addEventListener('change', () => {
    currentPage = 1;
    renderGames();
  });

  elements.filterGenre.addEventListener('change', () => {
    currentPage = 1;
    renderGames();
  });

  elements.sort.addEventListener('change', () => {
    currentPage = 1;
    renderGames();
  });

  elements.viewGrid.addEventListener('click', () => setView('grid'));
  elements.viewList.addEventListener('click', () => setView('list'));

  elements.pagePrev.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderGames();
    }
  });

  elements.pageNext.addEventListener('click', () => {
    currentPage++;
    renderGames();
  });

  elements.detailBack.addEventListener('click', () => closeDetail());

  elements.detailLaunch.addEventListener('click', () => launchGame(selectedGameId));
  elements.detailFavorite.addEventListener('click', () => toggleFavorite(selectedGameId));
  elements.detailEdit.addEventListener('click', () => editGame(selectedGameId));

  document.addEventListener('click', (e) => {
    const collection = e.target.closest('[data-collection]');
    if (collection) {
      selectCollection(collection.dataset.collection);
    }

    const gameCard = e.target.closest('[data-game-id]');
    if (gameCard && !e.target.closest('button')) {
      openDetail(gameCard.dataset.gameId);
    }

    const favoriteBtn = e.target.closest('[data-favorite]');
    if (favoriteBtn) {
      const gameId = favoriteBtn.closest('[data-game-id]')?.dataset.gameId;
      if (gameId) toggleFavorite(gameId);
    }
  });
}

function setView(view) {
  currentView = view;
  elements.viewGrid.classList.toggle('active', view === 'grid');
  elements.viewList.classList.toggle('active', view === 'list');
  elements.gameGrid.classList.toggle('list-view', view === 'list');
  renderGames();
}

function selectCollection(collectionId) {
  currentFilter.collection = collectionId;
  currentPage = 1;
  document.querySelectorAll('[data-collection]').forEach((el) => {
    el.classList.toggle('active', el.dataset.collection === collectionId);
  });
  renderGames();
}

async function refreshCounts() {
  const [all, fav, recent, nometa] = await Promise.all([
    store.listGames({ filter: {} }),
    store.listGames({ filter: { favorite: true } }),
    store.listGames({ filter: {}, sort: 'added', limit: 50 }),
    store.listGames({ filter: { hasMetadata: false } }),
  ]);

  elements.counts.all.textContent = all.length;
  elements.counts.fav.textContent = fav.length;
  elements.counts.recent.textContent = recent.length;
  elements.counts.nometa.textContent = nometa.length;
}

async function populateFilters() {
  const games = await store.listGames({ filter: {} });
  const platforms = new Set();
  const genres = new Set();

  for (const game of games) {
    if (game.platforms) game.platforms.forEach((p) => platforms.add(p));
    if (game.genres) game.genres.forEach((g) => genres.add(g));
  }

  elements.filterPlatform.innerHTML =
    '<option value="">All Platforms</option>' +
    Array.from(platforms)
      .sort()
      .map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`)
      .join('');
  elements.filterGenre.innerHTML =
    '<option value="">All Genres</option>' +
    Array.from(genres)
      .sort()
      .map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`)
      .join('');
}

async function renderGames() {
  const filter = { ...currentFilter };
  const search = elements.search.value.trim();
  if (search) filter.search = search;
  if (elements.filterPlatform.value) filter.platform = elements.filterPlatform.value;
  if (elements.filterGenre.value) filter.genre = elements.filterGenre.value;

  const sort = elements.sort.value;

  const games = await store.listGames({
    filter,
    sort,
    limit: PAGE_SIZE,
    offset: (currentPage - 1) * PAGE_SIZE,
  });

  const total = await store.listGames({ filter });
  const totalPages = Math.ceil(total.length / PAGE_SIZE);

  elements.gameGrid.innerHTML = '';
  elements.gameGrid.classList.remove('loading');

  if (games.length === 0) {
    elements.gameGrid.innerHTML = '<p class="empty">No games found.</p>';
    elements.pagination.classList.add('hidden');
    return;
  }

  const template = templates[currentView];
  const fragment = document.createDocumentFragment();

  for (const game of games) {
    const card = template.content.cloneNode(true);
    const article = card.querySelector('[data-game-id]');
    article.dataset.gameId = game.id;

    const cover = card.querySelector('[data-cover]');
    if (cover) {
      cover.src =
        game.coverArt ?? `data:image/svg+xml,${encodeURIComponent(placeholderSvg(game.title))}`;
      cover.alt = game.title;
    }

    const title = card.querySelector('[data-title]');
    if (title) title.textContent = game.title;

    const meta = card.querySelector('[data-meta]');
    if (meta) {
      const parts = [];
      if (game.platforms?.length) parts.push(game.platforms[0]);
      if (game.releaseDate) parts.push(game.releaseDate.split('-')[0]);
      meta.textContent = parts.join(' • ');
    }

    const tags = card.querySelector('[data-tags]');
    if (tags) {
      const gameTags = [];
      if (game.favorite) gameTags.push('<span class="tag favorite">★</span>');
      if (game.metadata) gameTags.push('<span class="tag metadata">Enriched</span>');
      if (game.hashes) gameTags.push('<span class="tag verified">Verified</span>');
      tags.innerHTML = gameTags.join(' ');
    }

    const favoriteBtn = card.querySelector('[data-favorite]');
    if (favoriteBtn) {
      favoriteBtn.classList.toggle('active', game.favorite);
      favoriteBtn.setAttribute(
        'aria-label',
        game.favorite ? 'Remove from favorites' : 'Add to favorites',
      );
    }

    fragment.appendChild(card);
  }

  elements.gameGrid.appendChild(fragment);

  elements.pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
  elements.pagePrev.disabled = currentPage <= 1;
  elements.pageNext.disabled = currentPage >= totalPages;
  elements.pagination.classList.remove('hidden');
}

async function openDetail(gameId) {
  const game = await store.getGame(gameId);
  if (!game) return;

  selectedGameId = gameId;
  elements.detail.hidden = false;

  elements.detailTitle.textContent = game.title;
  elements.detailMeta.textContent = [
    game.platforms?.[0],
    game.releaseDate?.split('-')[0],
    game.genres?.[0],
  ]
    .filter(Boolean)
    .join(' • ');

  elements.detailCover.src =
    game.coverArt ?? `data:image/svg+xml,${encodeURIComponent(placeholderSvg(game.title))}`;
  elements.detailCover.alt = game.title;

  elements.detailDescription.textContent = game.description ?? 'No description available.';

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

  elements.detailDetails.innerHTML = details
    .map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`)
    .join('');

  if (game.screenshots?.length) {
    elements.detailScreenshots.innerHTML = game.screenshots
      .map((url) => `<img src="${escapeHtml(url)}" alt="Screenshot" loading="lazy" />`)
      .join('');
  } else {
    elements.detailScreenshots.innerHTML = '<p class="empty">No screenshots available.</p>';
  }

  if (game.metadata) {
    elements.detailSources.innerHTML = Object.entries(game.metadata)
      .map(
        ([source, data]) =>
          `<div class="source-badge" data-source="${source}">
        <span class="source-name">${source.toUpperCase()}</span>
        <span class="source-priority">Priority: ${data._priority ?? 'N/A'}</span>
      </div>`,
      )
      .join('');
  } else {
    elements.detailSources.innerHTML =
      '<p class="empty">No metadata sources. Click "Enrich" to fetch.</p>';
  }

  elements.detailFavorite.classList.toggle('active', game.favorite);
  elements.detailFavorite.textContent = game.favorite ? '★ Favorited' : '★ Favorite';
}

function closeDetail() {
  elements.detail.hidden = true;
  selectedGameId = null;
}

async function toggleFavorite(gameId) {
  const game = await store.getGame(gameId);
  if (!game) return;
  await store.updateGame(gameId, { favorite: !game.favorite });
  await refreshCounts();
  await renderGames();
  if (selectedGameId === gameId) openDetail(gameId);
}

async function launchGame(gameId) {
  const game = await store.getGame(gameId);
  if (!game || !game.filePath) return;

  const launchUrl = `../emulation/index.html?launch=${encodeURIComponent(game.id)}&file=${encodeURIComponent(game.filePath)}`;
  window.location.href = launchUrl;
}

async function editGame(gameId) {
  closeDetail();
  window.location.href = `../library/edit.html?id=${gameId}`;
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

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
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
