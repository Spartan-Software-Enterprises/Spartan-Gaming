const PROVIDER_PRIORITY = Object.freeze({
  igdb: 10,
  hasheous: 9,
  rawg: 8,
  playmatch: 7,
  steamgriddb: 5,
});

const DEFAULT_HEADERS = Object.freeze({
  Accept: 'application/json',
  'User-Agent': 'SpartanGaming/0.1.0',
});

export class MetadataProvider {
  constructor({ name, baseUrl, apiKey, rateLimit = 4, supportedHashes = [] } = {}) {
    this.name = name;
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.rateLimit = rateLimit;
    this.supportedHashes = supportedHashes;
    this._lastRequest = 0;
    this._requestCount = 0;
    this._windowStart = Date.now();
  }

  async _request(endpoint, options = {}) {
    await this._rateLimit();

    const url = `${this.baseUrl}${endpoint}`;
    const headers = { ...DEFAULT_HEADERS, ...options.headers };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const error = await response.text().catch(() => '');
      throw new Error(`${this.name} API error: ${response.status} ${error}`);
    }

    return response.json();
  }

  async _rateLimit() {
    const now = Date.now();
    if (now - this._windowStart >= 1000) {
      this._requestCount = 0;
      this._windowStart = now;
    }
    if (this._requestCount >= this.rateLimit) {
      const wait = 1000 - (now - this._windowStart);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this._requestCount = 0;
      this._windowStart = Date.now();
    }
    this._requestCount++;
  }

  async searchByTitle(title, options = {}) {
    throw new Error('searchByTitle not implemented');
  }

  async searchByHash(hash, algorithm) {
    throw new Error('searchByHash not implemented');
  }

  async getGameDetails(id) {
    throw new Error('getGameDetails not implemented');
  }

  async getCoverArt(id, options = {}) {
    throw new Error('getCoverArt not implemented');
  }

  normalizeGame(raw) {
    return {
      id: raw.id?.toString(),
      name: raw.name ?? raw.title,
      sortTitle: raw.name?.replace(/^(a|an|the)\s+/i, ''),
      summary: raw.summary ?? raw.description,
      firstReleaseDate: raw.first_release_date
        ? new Date(raw.first_release_date * 1000).toISOString().split('T')[0]
        : raw.released?.split('T')[0],
      platforms:
        raw.platforms?.map((p) => p.name ?? p) ??
        raw.parent_platforms?.map((p) => p.platform?.name) ??
        [],
      genres: raw.genres?.map((g) => g.name) ?? raw.genres?.map((g) => g.name) ?? [],
      developer:
        raw.involved_companies?.find((c) => c.developer)?.company?.name ??
        raw.developers?.[0]?.name,
      publisher:
        raw.involved_companies?.find((c) => c.publisher)?.company?.name ??
        raw.publishers?.[0]?.name,
      coverArt: raw.cover?.url ? this._fixCoverUrl(raw.cover.url) : raw.background_image,
      screenshots:
        raw.screenshots?.map((s) => s.url) ?? raw.short_screenshots?.map((s) => s.image) ?? [],
      videos:
        raw.videos
          ?.map((v) => (v.video_id ? `https://www.youtube.com/watch?v=${v.video_id}` : v))
          .filter(Boolean) ?? [],
      rating: raw.rating ?? raw.rating_top ?? raw.metacritic,
      ratingCount: raw.rating_count,
      website: raw.website,
      similarGames: raw.similar_games?.map((g) => g.id?.toString()) ?? [],
      _source: this.name,
      _raw: raw,
    };
  }

  _fixCoverUrl(url) {
    if (!url) return null;
    return url.replace('t_thumb', 't_cover_big').replace('t_1080p', 't_cover_big');
  }
}

export function createMetadataProvider(config) {
  const providers = {
    igdb: () => new IGDBProvider(config.igdb),
    rawg: () => new RAWGProvider(config.rawg),
    hasheous: () => new HasheousProvider(config.hasheous),
    playmatch: () => new PlaymatchProvider(config.playmatch),
    steamgriddb: () => new SteamGridDBProvider(config.steamgriddb),
  };

  const results = {};
  for (const [name, factory] of Object.entries(providers)) {
    if (config[name]?.enabled !== false && config[name]?.apiKey) {
      results[name] = factory();
    }
  }
  return results;
}

export { PROVIDER_PRIORITY };
