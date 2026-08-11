/** Route virtual-gamepad operations to an optional driver while preserving the native keyboard/pointer adapter. */
export function createInputAdapterMux({
  platform,
  base,
  virtualGamepad = null,
  deviceIds = [],
} = {}) {
  if (!platform || !base || typeof base.execute !== 'function')
    throw new TypeError('a base input adapter is required');
  if (
    virtualGamepad &&
    (virtualGamepad.platform !== platform || typeof virtualGamepad.execute !== 'function')
  )
    throw new TypeError('virtual gamepad adapter must match the platform');
  const configuredDeviceIds = Array.isArray(deviceIds)
    ? Object.freeze(
        deviceIds
          .filter((value) => typeof value === 'string' && value.trim())
          .map((value) => value.trim())
          .slice(0, 8),
      )
    : Object.freeze([]);
  return Object.freeze({
    platform,
    async execute(operation) {
      if (
        virtualGamepad &&
        (operation?.kind === 'button' || operation?.kind === 'axis' || operation?.kind === 'rumble')
      ) {
        const index = Number.isInteger(operation?.gamepadIndex) ? operation.gamepadIndex : 0;
        const deviceId = configuredDeviceIds[index] || configuredDeviceIds[0];
        return virtualGamepad.execute(deviceId ? { ...operation, deviceId } : operation);
      }
      return base.execute(operation);
    },
    close() {
      virtualGamepad?.close?.();
      base.close?.();
    },
  });
}
