const CAPABILITIES = new Set(['haptics', 'motion', 'battery', 'multipleControllers']);

function boundedText(value, fallback = 'Android controller') {
  return typeof value === 'string' &&
    value.trim() &&
    value.length <= 128 &&
    !/[\u0000\r\n]/.test(value)
    ? value.trim()
    : fallback;
}

/** Normalize native Android controller metadata without forwarding raw device objects. */
export function normalizeAndroidControllerInventory(records = []) {
  if (!Array.isArray(records)) throw new TypeError('Android controller inventory must be an array');
  const normalized = records.slice(0, 8).map((record, index) => {
    const deviceId = Number(record?.deviceId);
    const capabilities = Array.isArray(record?.capabilities)
      ? [
          ...new Set(
            record.capabilities.filter(
              (value) => typeof value === 'string' && CAPABILITIES.has(value),
            ),
          ),
        ]
      : [];
    return Object.freeze({
      slot: index,
      deviceId: Number.isSafeInteger(deviceId) ? Math.max(0, Math.min(255, deviceId)) : index,
      name: boundedText(record?.name),
      vendorId: Number.isSafeInteger(Number(record?.vendorId))
        ? Math.max(0, Number(record.vendorId))
        : 0,
      productId: Number.isSafeInteger(Number(record?.productId))
        ? Math.max(0, Number(record.productId))
        : 0,
      capabilities: Object.freeze(capabilities),
    });
  });
  return Object.freeze({
    count: normalized.length,
    devices: Object.freeze(normalized),
    multipleControllers: normalized.length > 1,
  });
}

export const ANDROID_CONTROLLER_CAPABILITIES = Object.freeze([...CAPABILITIES]);
