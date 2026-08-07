import {spawn} from 'node:child_process';

const STATES = new Set(['idle', 'starting', 'running', 'stopping', 'stopped', 'failed']);
const DEFAULT_MAX_OUTPUT_BYTES = 64 * 1024;
const DEFAULT_STOP_TIMEOUT_MS = 2_000;

function events() {
  const listeners = new Map();
  return {
    on(type, handler) { if (typeof handler !== 'function') throw new TypeError('process event handler must be a function'); if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); return () => listeners.get(type)?.delete(handler); },
    emit(type, value) { for (const handler of listeners.get(type) || []) { try { handler(value); } catch { /* Observers cannot break process cleanup. */ } } },
  };
}

function bounded(value, fallback, minimum, maximum) { const number = Number(value); return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, Math.floor(number))) : fallback; }
function append(current, chunk, limit) { const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk); return (current + text).slice(-limit); }
function snapshot(state, child, output, exit) { return Object.freeze({state, pid: child?.pid ?? null, output: Object.freeze({...output}), exit: exit ? Object.freeze({...exit}) : null}); }

/**
 * Manage one shell-free native process. Nothing is spawned until start() is called.
 * Output is retained as a bounded tail so a noisy encoder cannot exhaust host memory.
 */
export function createManagedProcess({plan, spawnImpl = spawn, maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES, stopTimeoutMs = DEFAULT_STOP_TIMEOUT_MS} = {}) {
  if (!plan || plan.shell !== false || !Array.isArray(plan.args)) throw new TypeError('a shell-free process plan is required');
  if (typeof spawnImpl !== 'function') throw new TypeError('spawnImpl must be a function');
  const outputLimit = bounded(maxOutputBytes, DEFAULT_MAX_OUTPUT_BYTES, 1024, 4 * 1024 * 1024); const timeout = bounded(stopTimeoutMs, DEFAULT_STOP_TIMEOUT_MS, 100, 30_000); const bus = events();
  let state = 'idle'; let child = null; let output = {stdout: '', stderr: ''}; let exit = null; let startPromise;
  const emitState = next => { state = next; bus.emit('state', snapshot(state, child, output, exit)); };
  const bindStream = (stream, name) => stream?.on?.('data', chunk => { output = {...output, [name]: append(output[name], chunk, outputLimit)}; bus.emit('output', Object.freeze({stream: name, text: Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk)})); });
  const finish = (code, signal) => { exit = {code: code === undefined ? null : code, signal: signal || null}; if (state !== 'stopping') emitState(code === 0 ? 'stopped' : 'failed'); else emitState('stopped'); bus.emit('exit', snapshot(state, child, output, exit)); };
  const managed = {
    get state() { return state; }, get pid() { return child?.pid ?? null; }, get output() { return Object.freeze({...output}); }, get exit() { return exit ? Object.freeze({...exit}) : null; }, on: bus.on,
    start() {
      if (state !== 'idle') return Promise.reject(new Error(`process cannot start from ${state}`));
      emitState('starting');
      startPromise = new Promise((resolve, reject) => {
        try {
          child = spawnImpl(plan.executable, [...plan.args], {cwd: plan.cwd, env: {...process.env, ...plan.env}, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
          bindStream(child.stdout, 'stdout'); bindStream(child.stderr, 'stderr');
          let spawned = false;
          child.once?.('spawn', () => { spawned = true; emitState('running'); resolve(snapshot(state, child, output, exit)); });
          child.once?.('error', error => { if (!spawned) { exit = {code: null, signal: null, error: error.message}; emitState('failed'); reject(error); } else { bus.emit('error', error); } });
          child.once?.('close', (code, signal) => finish(code, signal));
        } catch (error) { exit = {code: null, signal: null, error: error.message}; emitState('failed'); reject(error); }
      });
      return startPromise;
    },
    async stop({signal = 'SIGTERM', timeoutMs = timeout} = {}) {
      if (!child || ['idle', 'stopped', 'failed'].includes(state)) return snapshot(state, child, output, exit);
      if (state === 'starting') await startPromise.catch(() => {});
      if (!child || ['stopped', 'failed'].includes(state)) return snapshot(state, child, output, exit);
      emitState('stopping'); child.kill?.(signal);
      await new Promise(resolve => { if (['stopped', 'failed'].includes(state)) return resolve(); const timer = setTimeout(() => { if (!['stopped', 'failed'].includes(state)) child.kill?.('SIGKILL'); resolve(); }, bounded(timeoutMs, timeout, 100, 30_000)); bus.on('exit', () => { clearTimeout(timer); resolve(); }) });
      return snapshot(state, child, output, exit);
    },
  };
  return Object.freeze(managed);
}

/** Start and stop a group of processes in order, rolling back on startup failure. */
export function createProcessPipeline({plans = [], spawnImpl = spawn, maxOutputBytes, stopTimeoutMs} = {}) {
  if (!Array.isArray(plans) || !plans.length) throw new TypeError('pipeline plans must contain at least one process plan');
  const processes = plans.map(plan => createManagedProcess({plan, spawnImpl, maxOutputBytes, stopTimeoutMs})); let state = 'idle';
  const pipeline = {
    get state() { return state; }, get processes() { return Object.freeze([...processes]); },
    async start() { if (state !== 'idle') throw new Error(`pipeline cannot start from ${state}`); state = 'starting'; const started = []; try { for (const process of processes) { await process.start(); started.push(process); } state = 'running'; return this.processes; } catch (error) { for (const process of started.reverse()) await process.stop(); state = 'failed'; throw error; } },
    async stop() { if (state === 'idle' || state === 'stopped') return this.processes; state = 'stopping'; for (const process of [...processes].reverse()) await process.stop(); state = 'stopped'; return this.processes; },
  };
  return Object.freeze(pipeline);
}
