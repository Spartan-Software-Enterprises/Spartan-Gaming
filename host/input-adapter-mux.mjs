/** Route virtual-gamepad operations to an optional driver while preserving the native keyboard/pointer adapter. */
export function createInputAdapterMux({platform, base, virtualGamepad = null} = {}) {
  if (!platform || !base || typeof base.execute !== 'function') throw new TypeError('a base input adapter is required');
  if (virtualGamepad && (virtualGamepad.platform !== platform || typeof virtualGamepad.execute !== 'function')) throw new TypeError('virtual gamepad adapter must match the platform');
  return Object.freeze({platform, async execute(operation) { if (virtualGamepad && (operation?.kind === 'button' || operation?.kind === 'axis')) return virtualGamepad.execute(operation); return base.execute(operation); }, close() { virtualGamepad?.close?.(); base.close?.(); }});
}
