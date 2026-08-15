const OPERATIONS = new Set(['button', 'axis', 'rumble']);

/** Create a macOS external virtual gamepad driver adapter. */
export function createVirtualGamepad({ platform, config, binding } = {}) {
  if (platform !== 'darwin')
    throw new TypeError('macOS virtual gamepad driver requires darwin platform');
  if (!binding || typeof binding.execute !== 'function')
    throw new Error('macOS virtual gamepad driver binding is unavailable');

  return Object.freeze({
    platform: 'darwin',
    kind: 'virtual-gamepad',
    id: 'macos-external-virtual-gamepad',
    execute(operation) {
      if (!OPERATIONS.has(operation?.kind)) return false;
      return binding.execute(operation) === true;
    },
    close() {
      binding.close?.();
    },
    capabilities: Object.freeze({
      platform: 'darwin',
      kind: 'virtual-gamepad',
      technology: 'macOS external driver',
      state: 'ready',
    }),
  });
}

export default { createVirtualGamepad };
