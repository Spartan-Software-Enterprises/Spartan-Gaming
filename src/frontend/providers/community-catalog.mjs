export const COMMUNITY_PROVIDER_CATALOG_KEY = 'spartan-gaming.community-provider-catalog.v1';
const MAX_SOURCE_BYTES = 500_000;
const MAX_PROVIDERS_PER_SOURCE = 64;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;
const KINDS = new Set([
  'cloud-gaming',
  'cloud-pc',
  'remote-play',
  'live-streaming',
  'social-streaming',
  'self-hosted-live-streaming',
]);
const MODES = new Set([
  'browser-first',
  'official-launch',
  'official-embed',
  'official-api',
  'user-owned-host',
  'self-hosted',
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
function required(value, name) {
  if (typeof value !== 'string' || !value.trim())
    throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}
function boundedString(value, name, maximum) {
  const result = required(value, name);
  if (result.length > maximum) throw new TypeError(`${name} is too long`);
  return result;
}
function httpsUrl(value, name) {
  const result = required(value, name);
  let url;
  try {
    url = new URL(result);
  } catch {
    throw new TypeError(`${name} must be an HTTPS URL`);
  }
  if (url.protocol !== 'https:') throw new TypeError(`${name} must be an HTTPS URL`);
  return url.href;
}
function list(value, name, maximum = 24) {
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.length > maximum ||
    value.some((item) => typeof item !== 'string' || !item.trim() || item.length > 80)
  )
    throw new TypeError(`${name} must be a bounded string array`);
  return [...new Set(value.map((item) => item.trim()))];
}

function normalizeSource(source) {
  const id = boundedString(source?.id, 'source.id', 64).toLowerCase();
  if (!ID_PATTERN.test(id)) throw new TypeError('source.id has invalid characters');
  return Object.freeze({
    id,
    name: boundedString(source.name, 'source.name', 120),
    homepage: httpsUrl(source.homepage, 'source.homepage'),
  });
}

export function normalizeCommunityProvider(provider, sourceId) {
  const id = boundedString(provider?.id, 'provider.id', 64).toLowerCase();
  if (!ID_PATTERN.test(id)) throw new TypeError('provider.id has invalid characters');
  const kind = required(provider.kind, 'provider.kind');
  if (!KINDS.has(kind)) throw new TypeError(`unsupported community provider kind: ${kind}`);
  const supportLevel = ['C', 'D'].includes(provider.supportLevel) ? provider.supportLevel : 'D';
  const integrationModes = list(provider.integrationModes, 'provider.integrationModes').filter(
    (mode) => MODES.has(mode),
  );
  if (!integrationModes.length)
    throw new TypeError('provider.integrationModes has no supported modes');
  return Object.freeze({
    id,
    name: boundedString(provider.name, 'provider.name', 120),
    kind,
    supportLevel,
    integrationModes: Object.freeze(integrationModes),
    url: httpsUrl(provider.url, 'provider.url'),
    requirements: Object.freeze(
      list(provider.requirements || ['provider-account'], 'provider.requirements'),
    ),
    capabilities: Object.freeze(
      list(provider.capabilities || ['gamepad', 'fullscreen'], 'provider.capabilities'),
    ),
    trust: 'community',
    sourceId,
  });
}

function normalizeBundle(bundle) {
  if (!bundle || bundle.version !== 1)
    throw new TypeError('community provider catalog version must be 1');
  const source = normalizeSource(bundle.source);
  if (
    !Array.isArray(bundle.providers) ||
    !bundle.providers.length ||
    bundle.providers.length > MAX_PROVIDERS_PER_SOURCE
  )
    throw new TypeError('community provider catalog providers are invalid');
  const ids = new Set();
  const providers = bundle.providers.map((provider) => {
    const normalized = normalizeCommunityProvider(provider, source.id);
    if (ids.has(normalized.id))
      throw new TypeError(`duplicate community provider id: ${normalized.id}`);
    ids.add(normalized.id);
    return normalized;
  });
  return Object.freeze({ version: 1, source, providers: Object.freeze(providers) });
}

function readBundles(storage, key) {
  try {
    const parsed = JSON.parse(storage?.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed.map(normalizeBundle) : [];
  } catch {
    return [];
  }
}
function writeBundles(storage, key, bundles) {
  storage?.setItem(key, JSON.stringify(bundles.map(clone)));
}

export function createCommunityProviderCatalogStore({
  storage = globalThis.localStorage,
  key = COMMUNITY_PROVIDER_CATALOG_KEY,
} = {}) {
  const read = () => readBundles(storage, key);
  const write = (bundles) => writeBundles(storage, key, bundles);
  return {
    list() {
      return read().flatMap((bundle) => bundle.providers.map(clone));
    },
    sources() {
      return read().map((bundle) => clone(bundle.source));
    },
    import(serialized) {
      if (typeof serialized === 'string' && serialized.length > MAX_SOURCE_BYTES)
        throw new TypeError('community provider catalog is too large');
      const parsed = typeof serialized === 'string' ? JSON.parse(serialized) : serialized;
      const bundles = Array.isArray(parsed?.sources)
        ? parsed.sources.map(normalizeBundle)
        : [normalizeBundle(parsed)];
      const current = read();
      const incomingIds = new Set();
      for (const bundle of bundles) {
        if (incomingIds.has(bundle.source.id))
          throw new TypeError(`duplicate community source id: ${bundle.source.id}`);
        incomingIds.add(bundle.source.id);
      }
      const next = [...current.filter((bundle) => !incomingIds.has(bundle.source.id)), ...bundles];
      write(next);
      return this.list();
    },
    remove(sourceId) {
      const id = required(sourceId, 'sourceId').toLowerCase();
      write(read().filter((bundle) => bundle.source.id !== id));
    },
    export() {
      return JSON.stringify({ version: 1, sources: read().map(clone) }, null, 2);
    },
  };
}

export function mergeCommunityProviders({ providers = [], community = [] } = {}) {
  const ids = new Set(providers.map((provider) => provider.id));
  const merged = [...providers];
  for (const provider of community) {
    if (ids.has(provider.id)) continue;
    ids.add(provider.id);
    merged.push(provider);
  }
  return merged;
}
