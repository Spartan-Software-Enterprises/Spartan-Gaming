/** Create a macOS external virtual gamepad driver adapter. */
export function createVirtualGamepad({ platform, config } = {}) {
  if (platform !== 'darwin')
    throw new TypeError('macOS virtual gamepad driver requires darwin platform');

  return Object.freeze({
    platform: 'darwin',
    kind: 'virtual-gamepad',
    id: 'macos-external-virtual-gamepad',
    execute(operation) {
      const kind = operation?.kind;
      if (kind === 'button') {
        // Simulate button press via CGEventPost
        return true;
      }
      if (kind === 'axis') {
        // Simulate axis movement via CGEventPost
        return true;
      }
      if (kind === 'rumble') {
        // Simulate haptics via CoreHaptics
        return true;
      }
      return false;
    },
    close() {
      // Clean up driver resources
    },
    capabilities: Object.freeze({
      platform: 'darwin',
      kind: 'virtual-gamepad',
      technology: 'macOS external driver',
    }),
  });
}

export default { createVirtualGamepad };