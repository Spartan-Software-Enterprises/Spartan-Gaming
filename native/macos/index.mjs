import {createRequire} from 'node:module';
const {createBindings: createReferenceBindings} = await import('../desktop/reference-adapter.mjs').catch(() => import('./reference-adapter.mjs'));

const require = createRequire(import.meta.url);

async function loadNativeModule() {
  try { return require('./spartan-native-macos.node'); }
  catch (error) { throw new Error(`macOS native input package is unavailable: ${error.message}`); }
}

export async function createBindings(options = {}) {
  const reference = await createReferenceBindings({platform: 'darwin', ...options});
  const module = await loadNativeModule();
  if (typeof module?.createBindings !== 'function') throw new Error('macOS native package does not export createBindings');
  const bindings = module.createBindings();
  if (!bindings?.input || typeof bindings.input.execute !== 'function') throw new Error('macOS native package does not provide input bindings');
  return Object.freeze({...reference, ...bindings, platform: 'darwin', capabilities: Object.freeze({...reference.capabilities, ...bindings.capabilities, input: true, keyboard: true, pointer: true, gamepad: Boolean(bindings.capabilities?.gamepad), virtualGamepad: Boolean(bindings.capabilities?.virtualGamepad), rumble: Boolean(bindings.capabilities?.rumble)}), capture: reference.capture, audio: reference.audio, async close() { bindings.input.close?.(); await reference.close(); }});
}
