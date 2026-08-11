const PERMISSIONS = Object.freeze([
  Object.freeze({ name: 'camera', label: 'Camera' }),
  Object.freeze({ name: 'microphone', label: 'Microphone' }),
  Object.freeze({ name: 'notifications', label: 'Notifications' }),
  Object.freeze({ name: 'geolocation', label: 'Location' }),
  Object.freeze({ name: 'clipboard-read', label: 'Clipboard read' }),
]);
const VALID_STATES = new Set(['granted', 'denied', 'prompt', 'unavailable']);

export async function collectPermissionStates({
  permissionsLike = globalThis.navigator?.permissions,
} = {}) {
  const states = await Promise.all(
    PERMISSIONS.map(async (permission) => {
      let state = 'unavailable';
      try {
        state = String(
          (await permissionsLike?.query?.({ name: permission.name }))?.state || 'unavailable',
        );
      } catch {
        state = 'unavailable';
      }
      return Object.freeze({
        name: permission.name,
        label: permission.label,
        state: VALID_STATES.has(state) ? state : 'unavailable',
      });
    }),
  );
  return Object.freeze(states);
}

export function collectPerformanceSnapshot({
  navigatorLike = globalThis.navigator,
  performanceLike = globalThis.performance,
} = {}) {
  const memory = performanceLike?.memory;
  const connection = navigatorLike?.connection;
  return Object.freeze({
    logicalProcessors: Number.isInteger(navigatorLike?.hardwareConcurrency)
      ? navigatorLike.hardwareConcurrency
      : null,
    memoryGb: Number.isFinite(navigatorLike?.deviceMemory) ? navigatorLike.deviceMemory : null,
    effectiveType: typeof connection?.effectiveType === 'string' ? connection.effectiveType : null,
    downlinkMbps: Number.isFinite(connection?.downlink) ? connection.downlink : null,
    networkRttMs: Number.isFinite(connection?.rtt) ? connection.rtt : null,
    jsHeapUsedMb: Number.isFinite(memory?.usedJSHeapSize)
      ? Math.round(memory.usedJSHeapSize / 1024 ** 2)
      : null,
    jsHeapLimitMb: Number.isFinite(memory?.jsHeapSizeLimit)
      ? Math.round(memory.jsHeapSizeLimit / 1024 ** 2)
      : null,
  });
}
