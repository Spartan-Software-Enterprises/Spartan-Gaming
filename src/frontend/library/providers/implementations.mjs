import { MetadataProvider } from './base.mjs';

export class IGDBProvider extends MetadataProvider {
  constructor(config = {}) {
    super({
      name: 'igdb',
      baseUrl: 'https://api.igdb.com/v4',
      apiKey: config.clientId && config.clientSecret ? null : config.apiKey,
      rateLimit: 4,
      supportedHashes: [],
    });
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.accessToken = null;
    this.tokenExpiry = 0;
  }

  async _ensureToken() {
    if (this.accessToken && Date.now() < this.tokenExpiry - 60000) return;

    if (!this.clientId || !this.clientSecret) {
      throw new Error('IGDB requires clientId and clientSecret for OAuth');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'client_credentials',
    });

    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      body: params,
    });

    if (!response.ok) {
      throw new Error(`IGDB OAuth failed: ${response.status}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;
  }

  async _request(endpoint, body) {
    await this._ensureToken();
    await this._rateLimit();

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Client-ID': this.clientId,
        Authorization: `Bearer ${this.accessToken}`,
        Accept: 'application/json',
      },
      body,
    });

    if (!response.ok) {
      const error = await response.text().catch(() => '');
      throw new Error(`IGDB API error: ${response.status} ${error}`);
    }

    return response.json();
  }

  async searchByTitle(title, options = {}) {
    const fields =
      'id,name,summary,first_release_date,platforms,genres,involved_companies,cover,screenshots,videos,rating,rating_count,website,similar_games';
    const where = `search "${title.replace(/"/g, '\\"')}"; where version_parent = null;`;
    const limit = options.limit ?? 10;

    const results = await this._request('/games', `fields ${fields}; ${where} limit ${limit};`);
    return results.map((r) => this.normalizeGame(r));
  }

  async searchByHash(hash, algorithm) {
    return null;
  }

  async getGameDetails(id) {
    const fields =
      'id,name,summary,first_release_date,platforms,genres,involved_companies,cover,screenshots,videos,rating,rating_count,website,similar_games,dlcs,expansions,standalone_expansions,bundles,franchise,franchises,game_engines,game_modes,player_perspectives,themes,keywords,age_ratings,aggregated_rating,aggregated_rating_count,checksum,collection,external_games,forks,parent_game,ports,remakes,remasters,similar_games,standalone_expansions,status,total_rating,total_rating_count,updated_at,url,version_parent,version_title,websites';
    const results = await this._request('/games', `fields ${fields}; where id = ${id};`);
    return results.length ? this.normalizeGame(results[0]) : null;
  }

  async getCoverArt(id, options = {}) {
    const size = options.size ?? 'cover_big';
    const results = await this._request('/covers', `fields url; where game = ${id}; limit 1;`);
    if (results.length) {
      return results[0].url.replace('t_thumb', `t_${size}`);
    }
    return null;
  }
}

export class RAWGProvider extends MetadataProvider {
  constructor(config = {}) {
    super({
      name: 'rawg',
      baseUrl: 'https://api.rawg.io/api',
      apiKey: config.apiKey,
      rateLimit: 20,
      supportedHashes: [],
    });
    this.pageSize = config.pageSize ?? 20;
  }

  async searchByTitle(title, options = {}) {
    const params = new URLSearchParams({
      search: title,
      page_size: options.limit ?? this.pageSize,
      key: this.apiKey,
    });

    const data = await this._request(`/games?${params}`);
    return data.results.map((r) => this.normalizeGame(r));
  }

  async searchByHash(hash, algorithm) {
    return null;
  }

  async getGameDetails(id) {
    const params = new URLSearchParams({ key: this.apiKey });
    const data = await this._request(`/games/${id}?${params}`);
    return this.normalizeGame(data);
  }

  async getCoverArt(id, options = {}) {
    const data = await this._request(`/games/${id}/screenshots?key=${this.apiKey}`);
    if (data.results.length) {
      return data.results[0].image;
    }
    return null;
  }

  normalizeGame(raw) {
    return {
      id: raw.id?.toString(),
      name: raw.name,
      sortTitle: raw.name?.replace(/^(a|an|the)\s+/i, ''),
      summary: raw.description_raw ?? raw.description,
      firstReleaseDate: raw.released,
      platforms: raw.platforms?.map((p) => p.platform?.name) ?? [],
      genres: raw.genres?.map((g) => g.name) ?? [],
      developer: raw.developers?.[0]?.name,
      publisher: raw.publishers?.[0]?.name,
      coverArt: raw.background_image,
      screenshots: raw.short_screenshots?.map((s) => s.image) ?? [],
      videos: [],
      rating: raw.rating,
      ratingCount: raw.ratings_count,
      website: raw.website,
      similarGames: raw.parent_platforms?.map((p) => p.platform?.slug) ?? [],
      _source: 'rawg',
      _raw: raw,
    };
  }
}

export class HasheousProvider extends MetadataProvider {
  constructor(config = {}) {
    super({
      name: 'hasheous',
      baseUrl: 'https://api.hasheous.org/v1',
      apiKey: config.apiKey,
      rateLimit: 10,
      supportedHashes: ['sha1', 'md5', 'crc32'],
    });
  }

  async searchByTitle(title, options = {}) {
    const params = new URLSearchParams({
      q: title,
      limit: options.limit ?? 10,
    });

    const data = await this._request(`/games/search?${params}`);
    return data.map((r) => this.normalizeGame(r));
  }

  async searchByHash(hash, algorithm) {
    const algoMap = { sha1: 'sha1', md5: 'md5', crc32: 'crc32' };
    const algo = algoMap[algorithm];
    if (!algo) return null;

    const data = await this._request(`/games/hash/${algo}/${hash}`);
    if (data.length) {
      return this.normalizeGame(data[0]);
    }
    return null;
  }

  async getGameDetails(id) {
    const data = await this._request(`/games/${id}`);
    return this.normalizeGame(data);
  }

  async getCoverArt(id, options = {}) {
    const data = await this._request(`/games/${id}/images`);
    if (data.length) {
      return data[0].url;
    }
    return null;
  }

  normalizeGame(raw) {
    return {
      id: raw.id?.toString(),
      name: raw.name,
      sortTitle: raw.name?.replace(/^(a|an|the)\s+/i, ''),
      summary: raw.description,
      firstReleaseDate: raw.release_date,
      platforms: raw.platforms ?? [],
      genres: raw.genres ?? [],
      developer: raw.developer,
      publisher: raw.publisher,
      coverArt: raw.cover_url,
      screenshots: raw.screenshots ?? [],
      videos: [],
      rating: raw.rating,
      ratingCount: raw.rating_count,
      website: raw.website,
      similarGames: [],
      _source: 'hasheous',
      _raw: raw,
    };
  }
}

export class PlaymatchProvider extends MetadataProvider {
  constructor(config = {}) {
    super({
      name: 'playmatch',
      baseUrl: 'https://playmatch.retrorealm.dev/api/v1',
      apiKey: config.apiKey,
      rateLimit: 10,
      supportedHashes: ['sha1', 'md5', 'crc32'],
    });
  }

  async searchByTitle(title, options = {}) {
    const params = new URLSearchParams({
      q: title,
      limit: options.limit ?? 10,
    });

    const data = await this._request(`/search?${params}`);
    return data.results.map((r) => this.normalizeGame(r));
  }

  async searchByHash(hash, algorithm) {
    const algoMap = { sha1: 'sha1', md5: 'md5', crc32: 'crc32' };
    const algo = algoMap[algorithm];
    if (!algo) return null;

    const data = await this._request(`/match/${algo}/${hash}`);
    if (data.matched) {
      return this.normalizeGame(data.game);
    }
    return null;
  }

  async getGameDetails(id) {
    const data = await this._request(`/games/${id}`);
    return this.normalizeGame(data);
  }

  async getCoverArt(id, options = {}) {
    const data = await this._request(`/games/${id}/images`);
    if (data.length) {
      return data[0].url;
    }
    return null;
  }

  normalizeGame(raw) {
    return {
      id: raw.id?.toString(),
      name: raw.name,
      sortTitle: raw.name?.replace(/^(a|an|the)\s+/i, ''),
      summary: raw.description,
      firstReleaseDate: raw.release_date,
      platforms: raw.platforms ?? [],
      genres: raw.genres ?? [],
      developer: raw.developer,
      publisher: raw.publisher,
      coverArt: raw.cover_url,
      screenshots: raw.screenshots ?? [],
      videos: [],
      rating: raw.rating,
      ratingCount: raw.rating_count,
      website: raw.website,
      similarGames: [],
      _source: 'playmatch',
      _raw: raw,
    };
  }
}

export class SteamGridDBProvider extends MetadataProvider {
  constructor(config = {}) {
    super({
      name: 'steamgriddb',
      baseUrl: 'https://www.steamgriddb.com/api/v2',
      apiKey: config.apiKey,
      rateLimit: 30,
      supportedHashes: [],
    });
  }

  async searchByTitle(title, options = {}) {
    const params = new URLSearchParams({
      term: title,
      limit: options.limit ?? 10,
    });

    const data = await this._request(`/search/autocomplete/${encodeURIComponent(title)}?${params}`);
    return data.data.map((r) => this.normalizeGame(r));
  }

  async searchByHash(hash, algorithm) {
    return null;
  }

  async getGameDetails(id) {
    const data = await this._request(`/grids/game/${id}`);
    return this.normalizeGame({ id, ...data });
  }

  async getCoverArt(id, options = {}) {
    const style = options.style ?? 'hero';
    const data = await this._request(`/grids/game/${id}?style=${style}`);
    if (data.data.length) {
      return data.data[0].url;
    }
    return null;
  }

  async getAllArt(id) {
    const [grids, heroes, logos, icons] = await Promise.all([
      this._request(`/grids/game/${id}?style=grid`),
      this._request(`/grids/game/${id}?style=hero`),
      this._request(`/grids/game/${id}?style=logo`),
      this._request(`/grids/game/${id}?style=icon`),
    ]);
    return {
      grids: grids.data.map((d) => d.url),
      heroes: heroes.data.map((d) => d.url),
      logos: logos.data.map((d) => d.url),
      icons: icons.data.map((d) => d.url),
    };
  }

  normalizeGame(raw) {
    return {
      id: raw.id?.toString(),
      name: raw.name,
      sortTitle: raw.name?.replace(/^(a|an|the)\s+/i, ''),
      coverArt: raw.url,
      _source: 'steamgriddb',
      _raw: raw,
    };
  }
}
