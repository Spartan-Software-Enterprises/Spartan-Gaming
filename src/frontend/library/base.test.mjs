import { MetadataProvider, PROVIDER_PRIORITY } from './base.mjs';
import { IGDBProvider } from './implementations.mjs';

describe('PROVIDER_PRIORITY', () => {
  it('has correct priority values', () => {
    expect(PROVIDER_PRIORITY.igdb).toBe(10);
    expect(PROVIDER_PRIORITY.hasheous).toBe(9);
    expect(PROVIDER_PRIORITY.rawg).toBe(8);
    expect(PROVIDER_PRIORITY.playmatch).toBe(7);
    expect(PROVIDER_PRIORITY.steamgriddb).toBe(5);
  });
});

describe('MetadataProvider base class', () => {
  let provider;

  beforeEach(() => {
    provider = new MetadataProvider({
      name: 'test',
      baseUrl: 'https://api.example.com',
      apiKey: 'test-key',
      rateLimit: 10,
    });
  });

  it('initializes with correct properties', () => {
    expect(provider.name).toBe('test');
    expect(provider.baseUrl).toBe('https://api.example.com');
    expect(provider.apiKey).toBe('test-key');
    expect(provider.rateLimit).toBe(10);
  });

  it('normalizes game data', () => {
    const raw = {
      id: 123,
      name: 'Test Game',
      summary: 'A test game',
      first_release_date: 1609459200,
      platforms: [{ name: 'PC' }, { name: 'PlayStation 5' }],
      genres: [{ name: 'Action' }, { name: 'Adventure' }],
      involved_companies: [
        { developer: true, company: { name: 'Dev Studio' } },
        { publisher: true, company: { name: 'Pub Corp' } },
      ],
      cover: { url: '//images.igdb.com/igdb/image/upload/t_thumb/test.jpg' },
      screenshots: [{ url: '//images.igdb.com/igdb/image/upload/t_thumb/shot1.jpg' }],
      videos: [{ video_id: 'abc123' }],
      rating: 85,
      rating_count: 100,
      website: 'https://example.com',
      similar_games: [{ id: 456 }],
    };

    const normalized = provider.normalizeGame(raw);

    expect(normalized.id).toBe('123');
    expect(normalized.name).toBe('Test Game');
    expect(normalized.sortTitle).toBe('Test Game');
    expect(normalized.summary).toBe('A test game');
    expect(normalized.firstReleaseDate).toBe('2021-01-01');
    expect(normalized.platforms).toEqual(['PC', 'PlayStation 5']);
    expect(normalized.genres).toEqual(['Action', 'Adventure']);
    expect(normalized.developer).toBe('Dev Studio');
    expect(normalized.publisher).toBe('Pub Corp');
    expect(normalized.coverArt).toContain('t_cover_big');
    expect(normalized.screenshots).toHaveLength(1);
    expect(normalized.videos).toHaveLength(1);
    expect(normalized.rating).toBe(85);
  });

  it('handles missing fields gracefully', () => {
    const raw = { id: 456 };
    const normalized = provider.normalizeGame(raw);
    expect(normalized.id).toBe('456');
    expect(normalized.name).toBeUndefined();
    expect(normalized.platforms).toEqual([]);
  });

  it('fixes cover URL size', () => {
    expect(provider._fixCoverUrl('//test.com/t_thumb/image.jpg')).toContain('t_cover_big');
    expect(provider._fixCoverUrl('//test.com/t_1080p/image.jpg')).toContain('t_cover_big');
    expect(provider._fixCoverUrl(null)).toBeNull();
  });
});

describe('IGDBProvider', () => {
  it('extends MetadataProvider', () => {
    const provider = new IGDBProvider({ clientId: 'test', clientSecret: 'secret' });
    expect(provider).toBeInstanceOf(MetadataProvider);
    expect(provider.name).toBe('igdb');
    expect(provider.clientId).toBe('test');
  });

  it('requires client credentials for OAuth', () => {
    const provider = new IGDBProvider({});
    expect(provider.clientId).toBeUndefined();
    expect(provider.clientSecret).toBeUndefined();
  });
});
