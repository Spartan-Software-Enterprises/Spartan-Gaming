const OPERATIONS = new Set(['button', 'axis', 'rumble']);

/** Create a Windows external virtual gamepad driver adapter. */
export function createVirtualGamepad({ platform, config, binding } = {}) {
  if (platform !== 'win32')
    throw new TypeError('Windows virtual gamepad driver requires win32 platform');
  if (!binding || typeof binding.execute !== 'function')
    throw new Error('Windows virtual gamepad driver binding is unavailable');

  return Object.freeze({
    platform: 'win32',
    kind: 'virtual-gamepad',
    id: 'windows-external-virtual-gamepad',
    execute(operation) {
      if (!OPERATIONS.has(operation?.kind)) return false;
      return binding.execute(operation) === true;
    },
    close() {
      binding.close?.();
    },
    capabilities: Object.freeze({
      platform: 'win32',
      kind: 'virtual-gamepad',
      technology: 'Windows external driver',
      state: 'ready',
    }),
  });
}

export default { createVirtualGamepad };
