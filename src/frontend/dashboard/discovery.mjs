const DEFAULT_LIMIT = 8;

function normalized(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export function entryReadiness(entry, adapters) {
  const plan = adapters?.get?.(entry.id)?.resolve?.();
  return plan?.readiness?.status || 'checking';
}

export function discoveryOptions(entries = []) {
  const providers = new Set();
  const platforms = new Set();
  const inputs = new Set();
  for (const entry of entries) {
    if (entry.backendType === 'provider' || entry.providerId) providers.add(entry.name);
    for (const platform of entry.systems || []) platforms.add(platform);
    for (const input of entry.capabilities || []) inputs.add(input);
  }
  return {
    providers: [...providers].sort((a, b) => a.localeCompare(b)),
    platforms: [...platforms].sort((a, b) => a.localeCompare(b)),
    inputs: [...inputs].sort((a, b) => a.localeCompare(b)),
    readiness: [
      ['ready', 'Ready'],
      ['configuration-required', 'Setup required'],
      ['native-adapter-required', 'Native adapter'],
      ['browser-capability-missing', 'Capability missing'],
      ['checking', 'Checking'],
    ],
  };
}

export function matchesDiscovery(entry, filters = {}, adapters) {
  const query = normalized(filters.search);
  const haystack = normalized(
    `${entry.name} ${entry.description || ''} ${(entry.systems || []).join(' ')} ${(entry.capabilities || []).join(' ')}`,
  );
  if (query && !haystack.includes(query)) return false;
  if (filters.provider && entry.name !== filters.provider && entry.providerId !== filters.provider)
    return false;
  if (filters.platform && !(entry.systems || []).includes(filters.platform)) return false;
  if (filters.input && !(entry.capabilities || []).includes(filters.input)) return false;
  if (filters.readiness && entryReadiness(entry, adapters) !== filters.readiness) return false;
  return true;
}

export function searchSuggestions(entries = [], query = '', limit = DEFAULT_LIMIT) {
  const needle = normalized(query);
  const values = new Set();
  for (const entry of entries) {
    for (const value of [entry.name, ...(entry.systems || []), ...(entry.capabilities || [])]) {
      if (value && (!needle || normalized(value).includes(needle))) values.add(value);
    }
  }
  return [...values].sort((a, b) => a.localeCompare(b)).slice(0, limit);
}
