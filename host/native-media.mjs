import {createManagedProcess} from './process.mjs';
import {spawn} from 'node:child_process';

function events() { const listeners = new Map(); return {on(type, handler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); return () => listeners.get(type)?.delete(handler); }, emit(type, value) { for (const handler of listeners.get(type) || []) { try { handler(value); } catch { /* observers cannot interrupt teardown */ } } }}; }
function validPlan(plan, name) { if (plan?.process?.shell !== false || !Array.isArray(plan.process.args)) throw new TypeError(`${name} must contain a shell-free process plan`); }

/**
 * Connect a platform capture process to an encoder process.
 * The encoded stdout stream is deliberately exposed for a future WebRTC/RTP publisher.
 */
export function createNativeMediaPipeline({capturePlan, encoderPlan, spawnImpl = spawn, maxOutputBytes, stopTimeoutMs} = {}) {
  validPlan(capturePlan, 'capturePlan'); validPlan(encoderPlan, 'encoderPlan');
  if (capturePlan.output?.target !== 'stdout') throw new TypeError('capturePlan must write media to stdout');
  const capture = createManagedProcess({plan: capturePlan.process, spawnImpl, maxOutputBytes, stopTimeoutMs});
  const encoder = createManagedProcess({plan: encoderPlan.process, spawnImpl, maxOutputBytes, stopTimeoutMs, stdio: ['pipe', 'pipe', 'pipe']});
  const bus = events(); let state = 'idle'; let unbind = [];
  const emitState = next => { state = next; bus.emit('state', next); };
  const forward = () => { const output = capture.streams.stdout; const input = encoder.streams.stdin; if (!output || !input) throw new Error('capture and encoder streams are unavailable'); output.pipe(input); unbind.push(() => output.unpipe(input)); };
  const pipeline = {
    get state() { return state; }, get capture() { return capture; }, get encoder() { return encoder; }, get videoOutput() { return encoder.streams.stdout; }, get audioOutput() { return encoder.streams.stdout; }, on: bus.on,
    async start() {
      if (state !== 'idle') throw new Error(`media pipeline cannot start from ${state}`); emitState('starting');
      try { await encoder.start(); await capture.start(); forward(); emitState('running'); bus.emit('started', {videoOutput: encoder.streams.stdout}); return this; }
      catch (error) { await capture.stop(); await encoder.stop(); emitState('failed'); throw error; }
    },
    async stop() {
      if (state === 'idle' || state === 'stopped') return this; emitState('stopping'); unbind.splice(0).forEach(off => off()); await capture.stop(); await encoder.stop(); emitState('stopped'); return this;
    },
  };
  capture.on('output', value => bus.emit('capture.output', value)); encoder.on('output', value => bus.emit('encoder.output', value)); capture.on('state', value => bus.emit('capture.state', value)); encoder.on('state', value => bus.emit('encoder.state', value));
  return Object.freeze(pipeline);
}
