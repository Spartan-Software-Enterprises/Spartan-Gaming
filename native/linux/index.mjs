import {createBindings as createReferenceBindings} from './reference-adapter.mjs';

import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);

async function loadUinputModule() {
  try { return require('./spartan-native-linux.node'); }
  catch { return null; }
}

/**
 * Compose the compiled Linux uinput gamepad binding with the shell-free
 * FFmpeg/X11 reference media binding. The compiled input package is optional
 * during development and never silently replaces a missing capability.
 */
export async function createBindings(options = {}) {
  const reference = await createReferenceBindings(options);
  const module = await loadUinputModule();
  if (typeof module?.createBindings !== 'function') return reference;
  const native = module.createBindings();
  const nativeInput = native?.input;
  if (!nativeInput || typeof nativeInput.execute !== 'function') return reference;
  return Object.freeze({
    ...reference,
    capabilities: Object.freeze({...reference.capabilities, input: true, keyboard: false, pointer: false, gamepad: true, rumble: false, technologies: Object.freeze({...reference.capabilities.technologies, input: 'Linux uinput virtual gamepad'})}),
    input: nativeInput,
    async close() { nativeInput.close?.(); await reference.close?.(); },
  });
}
