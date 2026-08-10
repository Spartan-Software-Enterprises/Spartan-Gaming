const STATES = new Set(['idle', 'loading', 'ready', 'running', 'paused', 'stopped', 'error']);

function events() { const listeners = new Map(); return {on(type, handler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); return () => listeners.get(type)?.delete(handler); }, emit(type, value) { for (const handler of listeners.get(type) || []) handler(value); }}; }
function required(value, name) { if (!value || typeof value !== 'object') throw new TypeError(`${name} is required`); return value; }
function selectedFile(file, name) { if (!file || file.userSelected !== true) throw new Error(`${name} must be explicitly selected by the user`); const selected = {...file}; if (file.source && typeof file.source.arrayBuffer === 'function') Object.defineProperty(selected, 'source', {value: file.source, enumerable: false, configurable: false, writable: false}); return Object.freeze(selected); }

/**
 * Adapt a browser-WASM or browser-hosted libretro implementation to the
 * frontend session lifecycle. The adapter owns emulation internals; this
 * boundary owns state, user-file validation, input routing, and teardown.
 * Selected File/Blob data is exposed to the adapter as a non-persisted
 * `source` property; metadata stores intentionally omit it.
 */
export function createBrowserEmulatorRuntime({adapter, canvas = null} = {}) {
  required(adapter, 'browser emulator adapter');
  if (typeof adapter.load !== 'function' || typeof adapter.start !== 'function' || typeof adapter.stop !== 'function') throw new TypeError('browser emulator adapter must provide load(), start(), and stop()');
  if (typeof adapter.id !== 'string' || !adapter.id.trim()) throw new TypeError('browser emulator adapter.id must be a non-empty string');
  const bus = events(); let state = 'idle'; let loaded = null;
  const setState = next => { if (!STATES.has(next)) throw new TypeError(`unsupported browser emulator state: ${next}`); state = next; bus.emit('state', next); return state; };
  const fail = error => { state = 'error'; bus.emit('error', error); bus.emit('state', state); throw error; };
  const runtime = {
    get state() { return state; },
    get adapterId() { return adapter.id; },
    get core() { return loaded?.core || null; },
    on: bus.on,
    async load({core, gameFile, firmwareFiles = [], settings = {}} = {}) {
      if (state === 'running' || state === 'paused' || state === 'loading') throw new Error(`cannot load while runtime is ${state}`);
      required(core, 'core'); const game = selectedFile(gameFile, 'game file'); const firmware = firmwareFiles.map((file, index) => selectedFile(file, `firmware file ${index + 1}`));
      if (typeof adapter.supports === 'function' && !adapter.supports(core)) throw new Error(`browser adapter ${adapter.id} does not support ${core.id || 'this core'}`);
      setState('loading');
      try { await adapter.load({core: Object.freeze({...core}), gameFile: game, firmwareFiles: Object.freeze(firmware), settings: Object.freeze({...settings}), canvas}); loaded = {core: Object.freeze({...core}), gameFile: game, firmwareFiles: Object.freeze(firmware)}; setState('ready'); return runtime; }
      catch (error) { loaded = null; return fail(error); }
    },
    async start() { if (state !== 'ready' && state !== 'paused') throw new Error(`cannot start while runtime is ${state}`); try { await adapter.start(); setState('running'); return runtime; } catch (error) { return fail(error); } },
    async pause() { if (state !== 'running') throw new Error(`cannot pause while runtime is ${state}`); try { await adapter.pause?.(); setState('paused'); return runtime; } catch (error) { return fail(error); } },
    async resume() { if (state !== 'paused') throw new Error(`cannot resume while runtime is ${state}`); try { await adapter.resume?.(); setState('running'); return runtime; } catch (error) { return fail(error); } },
    async reset() { if (!['ready', 'running', 'paused'].includes(state)) throw new Error(`cannot reset while runtime is ${state}`); try { await adapter.reset?.(); setState('ready'); return runtime; } catch (error) { return fail(error); } },
    async input(event) { if (state !== 'running' && state !== 'paused') throw new Error(`cannot send input while runtime is ${state}`); if (typeof adapter.input !== 'function') throw new Error('browser emulator adapter does not support input'); await adapter.input(event); bus.emit('input', event); return true; },
    async saveState() { if (!['ready', 'running', 'paused'].includes(state)) throw new Error(`cannot save state while runtime is ${state}`); if (typeof adapter.saveState !== 'function') throw new Error('browser emulator adapter does not support save states'); return adapter.saveState(); },
    async loadState(save) { if (!['ready', 'running', 'paused'].includes(state)) throw new Error(`cannot load state while runtime is ${state}`); const selected = selectedFile(save, 'save state'); if (typeof adapter.loadState !== 'function') throw new Error('browser emulator adapter does not support save states'); await adapter.loadState(selected); return runtime; },
    async stop() { if (state === 'stopped' || state === 'idle') { setState('stopped'); return runtime; } try { await adapter.stop(); loaded = null; setState('stopped'); return runtime; } catch (error) { return fail(error); } },
    async close() { if (state !== 'stopped' && state !== 'idle') await runtime.stop(); else loaded = null; bus.emit('closed'); },
  };
  return Object.freeze(runtime);
}
