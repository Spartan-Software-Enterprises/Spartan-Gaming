function adapterId(adapter) {
  if (!adapter || typeof adapter !== 'object' || typeof adapter.id !== 'string' || !adapter.id.trim()) throw new TypeError('browser emulator adapters require a non-empty id');
  if (typeof adapter.load !== 'function' || typeof adapter.start !== 'function' || typeof adapter.stop !== 'function') throw new TypeError(`browser emulator adapter ${adapter.id} must provide load(), start(), and stop()`);
  return adapter;
}

export function createBrowserEmulatorAdapterRegistry(adapters = []) {
  const entries = new Map();
  const register = adapter => { const checked = adapterId(adapter); if (entries.has(checked.id)) throw new Error(`browser emulator adapter already registered: ${checked.id}`); entries.set(checked.id, checked); return checked; };
  for (const adapter of adapters) register(adapter);
  return Object.freeze({list() { return Object.freeze([...entries.values()]); }, register, resolve(coreId) { return [...entries.values()].find(adapter => typeof adapter.supports !== 'function' || adapter.supports({id: coreId})) || null; }});
}

export function discoverBrowserEmulatorAdapters(scope = globalThis) { const adapters = scope?.__SPARTAN_BROWSER_EMULATOR_ADAPTERS__; return Array.isArray(adapters) ? adapters : []; }
