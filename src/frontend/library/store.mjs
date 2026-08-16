import { openLibraryDB } from './db/index.mjs';
import { createMetadataProvider } from './providers/index.mjs';
import { scanDirectory } from './scanner/index.mjs';

const STATE_VERSION = 1;

function createLibraryStore({ dbPath = 'spartan-library', metadataProviders = [] } = {}) {
  let db = null;
  let initialized = false;
  let currentScan = null;
  let metadataCache = new Map();

  const state = {
    games: new Map(),
    collections: new Map(),
    scanProgress: { phase: 'idle', current: 0, total: 0 },
    settings: {
      libraryPaths: [],
      metadataProviders: metadataProviders.map((p) => p.name),
      autoScan: true,
      scanInterval: 24 * 60 * 60 * 1000,
      preferredCoverArt: 'cover',
    },
  };

  async function init() {
    if (initialized) return;
    db = await openLibraryDB(dbPath);
    await loadSettings();
    await loadGames();
    initialized = true;
    return state;
  }

  async function loadSettings() {
    const stored = await db.settings.get('library');
    if (stored) {
      Object.assign(state.settings, stored);
    }
  }

  async function saveSettings() {
    await db.settings.put({ key: 'library', ...state.settings, updatedAt: Date.now() });
  }

  async function loadGames() {
    const cursor = db.games.iterate();
    for await (const game of cursor) {
      state.games.set(game.id, game);
    }
  }

  async function addGame(game) {
    const id = game.id ?? crypto.randomUUID();
    const entry = {
      ...game,
      id,
      addedAt: game.addedAt ?? Date.now(),
      updatedAt: Date.now(),
      version: STATE_VERSION,
    };
    await db.games.put(entry);
    state.games.set(id, entry);
    return entry;
  }

  async function updateGame(id, updates) {
    const game = state.games.get(id);
    if (!game) throw new Error(`Game not found: ${id}`);
    const updated = { ...game, ...updates, updatedAt: Date.now() };
    await db.games.put(updated);
    state.games.set(id, updated);
    return updated;
  }

  async function removeGame(id) {
    await db.games.delete(id);
    state.games.delete(id);
  }

  async function getGame(id) {
    return state.games.get(id);
  }

  async function listGames({ filter = null, sort = 'title', limit = null, offset = 0 } = {}) {
    let games = Array.from(state.games.values());

    if (filter) {
      if (filter.platform) {
        games = games.filter((g) => g.platforms?.includes(filter.platform));
      }
      if (filter.genre) {
        games = games.filter((g) => g.genres?.includes(filter.genre));
      }
      if (filter.search) {
        const q = filter.search.toLowerCase();
        games = games.filter(
          (g) =>
            g.title?.toLowerCase().includes(q) ||
            g.alternateTitles?.some((t) => t.toLowerCase().includes(q)),
        );
      }
      if (filter.hasMetadata !== undefined) {
        games = games.filter((g) => Boolean(g.metadata) === filter.hasMetadata);
      }
      if (filter.favorite !== undefined) {
        games = games.filter((g) => g.favorite === filter.favorite);
      }
    }

    games.sort((a, b) => {
      switch (sort) {
        case 'title':
          return (a.sortTitle ?? a.title ?? '').localeCompare(b.sortTitle ?? b.title ?? '');
        case 'added':
          return (b.addedAt ?? 0) - (a.addedAt ?? 0);
        case 'updated':
          return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
        case 'playtime':
          return (b.playtime ?? 0) - (a.playtime ?? 0);
        case 'rating':
          return (b.rating ?? 0) - (a.rating ?? 0);
        default:
          return 0;
      }
    });

    if (offset > 0) games = games.slice(offset);
    if (limit) games = games.slice(0, limit);
    return games;
  }

  async function enrichGameMetadata(gameId) {
    const game = state.games.get(gameId);
    if (!game) throw new Error(`Game not found: ${gameId}`);

    for (const provider of metadataProviders) {
      if (!state.settings.metadataProviders.includes(provider.name)) continue;

      try {
        let metadata = null;

        if (provider.searchByHash && game.hashes) {
          for (const [algo, hash] of Object.entries(game.hashes)) {
            if (provider.supportedHashes?.includes(algo)) {
              metadata = await provider.searchByHash(hash, algo);
              if (metadata) break;
            }
          }
        }

        if (!metadata && game.title) {
          metadata = await provider.searchByTitle(game.title, { platform: game.platform });
        }

        if (metadata) {
          await applyMetadata(gameId, provider.name, metadata);
          break;
        }
      } catch (error) {
        console.warn(`Metadata provider ${provider.name} failed:`, error);
      }
    }

    return state.games.get(gameId);
  }

  async function applyMetadata(gameId, providerName, metadata) {
    const game = state.games.get(gameId);
    if (!game) return;

    const existing = game.metadata?.[providerName] ?? {};
    const merged = mergeMetadata(existing, metadata, providerName);

    await updateGame(gameId, {
      metadata: { ...game.metadata, [providerName]: merged },
      title: game.title ?? merged.name,
      sortTitle: merged.name?.replace(/^(a|an|the)\s+/i, ''),
      platforms: merged.platforms ?? game.platforms,
      genres: merged.genres ?? game.genres,
      releaseDate: merged.firstReleaseDate ?? game.releaseDate,
      description: merged.summary ?? game.description,
      coverArt: merged.coverArt ?? game.coverArt,
      screenshots: merged.screenshots ?? game.screenshots,
      videos: merged.videos ?? game.videos,
      rating: merged.rating ?? game.rating,
      developer: merged.developer ?? game.developer,
      publisher: merged.publisher ?? game.publisher,
    });
  }

  function mergeMetadata(existing, incoming, provider) {
    const priority = { igdb: 10, rawg: 8, hasheous: 9, playmatch: 7, steamgriddb: 5 };
    const providerPriority = priority[provider] ?? 0;
    const existingPriority = Math.max(...Object.keys(existing).map((k) => priority[k] ?? 0), 0);

    if (providerPriority >= existingPriority) {
      return { ...existing, ...incoming, _source: provider, _priority: providerPriority };
    }
    return existing;
  }

  async function startScan(paths = state.settings.libraryPaths) {
    if (currentScan) throw new Error('Scan already in progress');

    currentScan = {
      phase: 'scanning',
      paths,
      current: 0,
      total: 0,
      startTime: Date.now(),
      abortController: new AbortController(),
    };
    state.scanProgress = currentScan;

    try {
      const results = await scanDirectory(paths, {
        signal: currentScan.abortController.signal,
        onProgress: (current, total) => {
          if (currentScan) {
            currentScan.current = current;
            currentScan.total = total;
          }
        },
        onFile: async (file) => {
          const game = await processRomFile(file);
          if (game) await addGame(game);
        },
      });
      currentScan.phase = 'complete';
      currentScan.results = results;
    } catch (error) {
      currentScan.phase = 'error';
      currentScan.error = error.message;
      throw error;
    } finally {
      currentScan = null;
    }
  }

  async function processRomFile(file) {
    const { hashFile } = await import('./hashing/index.mjs');
    const hashes = await hashFile(file);

    const existing = Array.from(state.games.values()).find(
      (g) => g.hashes && Object.values(g.hashes).some((h) => Object.values(hashes).includes(h)),
    );

    if (existing) {
      return updateGame(existing.id, { filePath: file.path, hashes, updatedAt: Date.now() });
    }

    const name = file.name.replace(/\.[^.]+$/, '');
    return addGame({
      title: name,
      filePath: file.path,
      fileSize: file.size,
      hashes,
      platform: detectPlatform(file.name),
      source: 'local',
    });
  }

  function detectPlatform(filename) {
    const ext = filename.toLowerCase().split('.').pop();
    const platformMap = {
      nes: 'NES',
      smc: 'SNES',
      sfc: 'SNES',
      gb: 'Game Boy',
      gbc: 'Game Boy Color',
      gba: 'Game Boy Advance',
      n64: 'N64',
      z64: 'N64',
      v64: 'N64',
      iso: 'PlayStation',
      bin: 'PlayStation',
      cue: 'PlayStation',
      chd: 'Multiple',
      gdi: 'Dreamcast',
      wbfs: 'Wii',
      rvz: 'Wii',
      wad: 'Wii',
      cia: '3DS',
      '3ds': '3DS',
      nds: 'Nintendo DS',
      dsi: 'Nintendo DSi',
      xiso: 'Xbox',
      iso: 'Xbox',
      rom: 'Multiple',
      img: 'Multiple',
    };
    return platformMap[ext] ?? 'Unknown';
  }

  async function setLibraryPaths(paths) {
    state.settings.libraryPaths = paths;
    await saveSettings();
  }

  async function setMetadataProviders(providers) {
    state.settings.metadataProviders = providers;
    await saveSettings();
  }

  async function createCollection(name, gameIds) {
    const id = crypto.randomUUID();
    const collection = { id, name, gameIds, createdAt: Date.now() };
    await db.collections.put(collection);
    state.collections.set(id, collection);
    return collection;
  }

  async function getCollections() {
    return Array.from(state.collections.values());
  }

  async function getScanProgress() {
    return { ...state.scanProgress };
  }

  async function cancelScan() {
    if (currentScan) {
      currentScan.abortController.abort();
    }
  }

  async function close() {
    if (db) {
      await db.close();
      db = null;
    }
    initialized = false;
  }

  return Object.freeze({
    init,
    addGame,
    updateGame,
    removeGame,
    getGame,
    listGames,
    enrichGameMetadata,
    startScan,
    cancelScan,
    getScanProgress,
    setLibraryPaths,
    setMetadataProviders,
    createCollection,
    getCollections,
    close,
    get state() {
      return state;
    },
  });
}

export { createLibraryStore };
