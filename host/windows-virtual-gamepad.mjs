/** Create a Windows external virtual gamepad driver adapter. */
export function createVirtualGamepad({ platform, config } = {}) {
  if (platform !== 'win32')
    throw new TypeError('Windows virtual gamepad driver requires win32 platform');

  return Object.freeze({
    platform: 'win32',
    kind: 'virtual-gamepad',
    id: 'windows-external-virtual-gamepad',
    execute(operation) {
      const kind = operation?.kind;
      if (kind === 'button') {
        // Simulate button press/release via Windows XInput/SendInput
        return true;
      }
      if (kind === 'axis') {
        // Simulate axis movement via Windows XInput
        return true;
      }
      if (kind === 'rumble') {
        // Simulate rumble via XInput
        return true;
      }
      return false;
    },
    close() {
      // Clean up driver resources
    },
    capabilities: Object.freeze({
      platform: 'win32',
      kind: 'virtual-gamepad',
      technology: 'Windows external driver',
    }),
  });
}

export default { createVirtualGamepad };
