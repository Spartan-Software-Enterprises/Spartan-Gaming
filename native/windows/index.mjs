async function loadNativeModule() {
  try { return await import('./spartan-native-windows.node'); }
  catch (error) { throw new Error(`Windows native input package is unavailable: ${error.message}`); }
}

export async function createBindings() {
  const module = await loadNativeModule();
  if (typeof module?.createBindings !== 'function') throw new Error('Windows native package does not export createBindings');
  const bindings = module.createBindings();
  if (!bindings?.input || typeof bindings.input.execute !== 'function') throw new Error('Windows native package does not provide input bindings');
  return Object.freeze({...bindings, platform: 'win32', capabilities: Object.freeze({...bindings.capabilities, input: true, keyboard: true, pointer: true, gamepad: false, rumble: false})});
}
