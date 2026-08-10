export const FAVORITES_STORAGE_PREFIX = 'spartan-gaming.favorites.v2.';
const LEGACY_FAVORITES_KEY = 'spartan-gaming.favorites.v1';

function workspaceId(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{1,63}$/.test(normalized)) throw new TypeError('workspaceId must use a safe profile identifier');
  return normalized;
}

function normalizeIds(value) { return Array.isArray(value) ? [...new Set(value.filter(item => typeof item === 'string' && /^[a-z0-9][a-z0-9._-]{1,127}$/.test(item)).slice(0, 500))] : []; }

export function createFavoritesStore({storage = globalThis.localStorage, workspaceId: id} = {}) {
  const normalizedWorkspaceId = workspaceId(id); const key = `${FAVORITES_STORAGE_PREFIX}${normalizedWorkspaceId}`;
  const read = () => { try { const current = storage?.getItem(key); if (current === null && normalizedWorkspaceId === 'gaming') { const legacy = normalizeIds(JSON.parse(storage?.getItem(LEGACY_FAVORITES_KEY) || '[]')); if (legacy.length) storage?.setItem(key, JSON.stringify(legacy)); return legacy; } return normalizeIds(JSON.parse(current || '[]')); } catch { return []; } };
  const write = ids => { const normalized = normalizeIds(ids); storage?.setItem(key, JSON.stringify(normalized)); return normalized; };
  return Object.freeze({key, list() { return Object.freeze(read()); }, has(backendId) { return read().includes(backendId); }, set(ids) { return Object.freeze(write(ids)); }, toggle(backendId) { const ids = read(); const next = ids.includes(backendId) ? ids.filter(idValue => idValue !== backendId) : [...ids, backendId]; return Object.freeze(write(next)); }, clear() { storage?.removeItem?.(key); return []; }});
}
