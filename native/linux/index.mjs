import {createBindings as createReferenceBindings} from './reference-adapter.mjs';

import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);

async function loadUinputModule() {
  try { return require('./spartan-native-linux.node'); }
  catch { return null; }
}

export function composeLinuxInput({reference, native} = {}) {
  const referenceInput = reference?.input;
  const nativeInput = native?.input;
  if (!nativeInput || typeof nativeInput.execute !== 'function') return referenceInput;
  const nativeGamepad = native?.capabilities?.gamepad === true;
  const nativeRumble = native?.capabilities?.rumble === true;
  return Object.freeze({
    async execute(operation) {
      const kind = operation?.kind;
      if ((kind === 'button' || kind === 'axis') && nativeGamepad) return nativeInput.execute(operation);
      if (kind === 'rumble' && nativeRumble) return nativeInput.execute(operation);
      if (typeof referenceInput?.execute !== 'function') throw new Error(`Linux input adapter does not implement ${kind || 'unknown'} events`);
      return referenceInput.execute(operation);
    },
    readRumbleEvents() { return typeof nativeInput.readRumbleEvents === 'function' ? nativeInput.readRumbleEvents() : []; },
    close() { nativeInput.close?.(); referenceInput?.close?.(); },
  });
}

/**
 * Compose the compiled Linux uinput gamepad binding with the shell-free
 * FFmpeg/X11 reference media binding. The compiled input package is optional
 * during development and never silently replaces a missing capability.
 */
export async function createBindings(options = {}) {
  const reference = await createReferenceBindings(options);
  const module = options.nativeModule === undefined ? await loadUinputModule() : options.nativeModule;
  if (typeof module?.createBindings !== 'function') return reference;
  const native = module.createBindings();
  const nativeInput = native?.input;
  if (!nativeInput || typeof nativeInput.execute !== 'function') return reference;
  return Object.freeze({
    ...reference,
    capabilities: Object.freeze({...reference.capabilities, input: Boolean(reference.capabilities.input || native.capabilities?.gamepad), keyboard: Boolean(reference.capabilities.keyboard), pointer: Boolean(reference.capabilities.pointer), gamepad: Boolean(native.capabilities?.gamepad), virtualGamepad: Boolean(native.capabilities?.virtualGamepad ?? native.capabilities?.gamepad), rumble: Boolean(native.capabilities?.rumble || reference.capabilities.rumble), technologies: Object.freeze({...reference.capabilities.technologies, input: 'Linux uinput virtual gamepad + reference keyboard/pointer', haptics: native.capabilities?.rumble ? 'Linux uinput force feedback' : reference.capabilities.technologies?.haptics})}),
    input: composeLinuxInput({reference, native}),
    async close() { nativeInput.close?.(); await reference.close?.(); },
  });
}
