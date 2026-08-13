const validSupportLevels = new Set(['A', 'B', 'C', 'D']);
const validKinds = new Set([
  'cloud-gaming',
  'cloud-pc',
  'remote-play',
  'live-streaming',
  'social-streaming',
  'self-hosted-live-streaming',
  'multi-system',
  'native-emulator',
  'browser-or-native',
  'native',
  'native-or-wasm-candidate',
  'emulator',
  'adventure-engines',
  'arcade',
  'playstation-1',
  'playstation-2',
  'playstation-3',
  'psp',
  'nintendo-ds',
  'nintendo-3ds',
  'gamecube',
  'wii',
  'dreamcast',
  'naomi',
  'atomiswave',
  'original-xbox',
  'browser-game',
  'game-library',
]);

function assertString(value, field, id) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${id}: ${field} must be a non-empty string`);
  }
}

function assertArray(value, field, id) {
  if (!Array.isArray(value)) throw new TypeError(`${id}: ${field} must be an array`);
}

function assertHttpsUrl(value, id) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
  } catch {
    throw new TypeError(`${id}: url must use HTTPS without credentials`);
  }
}

function assertDate(value, source) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value))
    throw new TypeError(`${source} updatedAt must use YYYY-MM-DD`);
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day)
    throw new TypeError(`${source} updatedAt must be a valid date`);
}

function validateEntry(entry, source) {
  const id = entry?.id ?? '<unknown>';
  assertString(entry?.id, 'id', id);
  assertString(entry?.name, 'name', id);
  if (source !== 'emulator') assertString(entry?.kind, 'kind', id);
  if (source !== 'emulator' && !validKinds.has(entry.kind)) {
    throw new TypeError(`${id}: unsupported ${source} kind ${entry.kind}`);
  }
  if (source !== 'emulator' && !validSupportLevels.has(entry.supportLevel)) {
    throw new TypeError(`${id}: supportLevel must be A, B, C, or D`);
  }
  if (source === 'provider' || source === 'game') {
    assertArray(entry.integrationModes, 'integrationModes', id);
    assertArray(entry.capabilities, 'capabilities', id);
    assertString(entry.url, 'url', id);
    assertHttpsUrl(entry.url, id);
    assertArray(entry.requirements, 'requirements', id);
    if (source === 'game') {
      assertArray(entry.genres, 'genres', id);
      assertString(entry.license, 'license', id);
    }
  } else {
    assertArray(entry.systems, 'systems', id);
    assertString(entry.mode, 'mode', id);
    assertString(entry.url, 'url', id);
    assertHttpsUrl(entry.url, id);
    assertString(entry.license, 'license', id);
  }
  return entry;
}

function normalize(entry, source) {
  validateEntry(entry, source);
  const integrationModes = entry.integrationModes ?? [
    entry.mode === 'native' ? 'native-adapter' : 'browser-runtime',
  ];
  const capabilities = entry.capabilities ?? ['gamepad', 'fullscreen', 'save-state'];
  return Object.freeze({
    ...entry,
    kind: entry.kind ?? 'emulator',
    supportLevel: entry.supportLevel ?? (entry.priority === 'tier-1' ? 'B' : 'C'),
    backendType: source,
    launchMode: source === 'provider' || source === 'game' ? 'web' : entry.mode,
    integrationModes: Object.freeze([...integrationModes]),
    capabilities: Object.freeze([...capabilities]),
    ...(source === 'provider'
      ? { requirements: Object.freeze([...entry.requirements]) }
      : source === 'game'
        ? {
            requirements: Object.freeze([...entry.requirements]),
            systems: Object.freeze([...entry.genres]),
          }
        : { systems: Object.freeze([...entry.systems]) }),
  });
}

/**
 * Build the frontend's single backend catalog from provider and emulator manifests.
 * The returned entries are immutable so UI state cannot mutate the source manifests.
 */
export function createFrontendCatalog({ providers = [], emulators = [], games = [] } = {}) {
  const entries = [
    ...providers.map((entry) => normalize(entry, 'provider')),
    ...emulators.map((entry) => normalize(entry, 'emulator')),
    ...games.map((entry) => normalize(entry, 'game')),
  ];
  const ids = new Set();
  for (const entry of entries) {
    if (ids.has(entry.id)) throw new Error(`duplicate backend id: ${entry.id}`);
    ids.add(entry.id);
  }
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  return Object.freeze({
    entries: Object.freeze(entries),
    get(id) {
      return byId.get(id);
    },
    find({ backendType, kind, capability, supportLevel } = {}) {
      return entries.filter(
        (entry) =>
          (!backendType || entry.backendType === backendType) &&
          (!kind || entry.kind === kind) &&
          (!capability || entry.capabilities.includes(capability)) &&
          (!supportLevel || entry.supportLevel === supportLevel),
      );
    },
  });
}

export function validateCatalogManifest(manifest, source) {
  if (!manifest || manifest.catalogVersion !== 1) {
    throw new TypeError(`${source} catalogVersion must be 1`);
  }
  const key = source === 'provider' ? 'providers' : source === 'emulator' ? 'projects' : 'games';
  const entries = manifest[key];
  assertArray(entries, key, source);
  assertDate(manifest.updatedAt, source);
  const ids = new Set();
  for (const entry of entries) {
    if (ids.has(entry?.id)) throw new Error(`duplicate ${source} catalog id: ${entry.id}`);
    ids.add(entry?.id);
  }
  return entries.map((entry) => validateEntry(entry, source));
}
