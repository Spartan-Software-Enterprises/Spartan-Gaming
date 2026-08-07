export const LAUNCH_HISTORY_KEY = 'spartan-gaming.launch-history.v1';

function required(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}

function normalize(record) {
  return Object.freeze({backendId: required(record?.backendId, 'backendId'), backendType: required(record?.backendType, 'backendType'), name: required(record?.name, 'name'), mode: required(record?.mode, 'mode'), action: required(record?.action, 'action'), launchedAt: required(record?.launchedAt || record?.at, 'launchedAt')});
}

export function createLaunchHistoryStore({storage = globalThis.localStorage, key = LAUNCH_HISTORY_KEY, maxEntries = 12} = {}) {
  if (!Number.isInteger(maxEntries) || maxEntries < 1 || maxEntries > 50) throw new RangeError('maxEntries must be between 1 and 50');
  const read = () => { try { const parsed = JSON.parse(storage?.getItem(key) || '[]'); return Array.isArray(parsed) ? parsed.map(normalize) : []; } catch { return []; } };
  const write = records => storage?.setItem(key, JSON.stringify(records.map(record => ({...record}))));
  return Object.freeze({list() { return read().map(record => ({...record})); }, record(input) { const record = normalize(input); const records = [record, ...read().filter(item => item.backendId !== record.backendId)].slice(0, maxEntries); write(records); return {...record}; }, clear() { storage?.removeItem?.(key); }});
}
