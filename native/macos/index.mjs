import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);

async function loadNativeModule() {
  try { return require('./spartan-native-macos.node'); }
  catch (error) { throw new Error(`macOS native input package is unavailable: ${error.message}`); }
}

export async function createBindings() {
  const module = await loadNativeModule();
  if (typeof module?.createBindings !== 'function') throw new Error('macOS native package does not export createBindings');
  const bindings = module.createBindings();
  if (!bindings?.input || typeof bindings.input.execute !== 'function') throw new Error('macOS native package does not provide input bindings');
  return Object.freeze({...bindings, platform: 'darwin', capabilities: Object.freeze({...bindings.capabilities, input: true, keyboard: true, pointer: true, gamepad: false, rumble: false})});
}
