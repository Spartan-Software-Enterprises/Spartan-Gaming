const MAX_ID_LENGTH = 128;
const MAX_NAME_LENGTH = 96;
const MAX_DEVICES = 64;

export const BLUETOOTH_PLATFORMS = Object.freeze([
  'win32',
  'darwin',
  'linux',
  'android',
  'steamos',
  'chromeos',
  'firetv',
]);

export const BLUETOOTH_TRANSPORTS = Object.freeze(['bluetooth-classic', 'ble']);

export const BLUETOOTH_DEVICE_KINDS = Object.freeze([
  'controller',
  'keyboard',
  'mouse',
  'remote',
  'audio-input',
  'audio-output',
  'haptics',
  'unknown',
]);

const CAPABILITY_KEYS = Object.freeze([
  'hid',
  'audioInput',
  'audioOutput',
  'rumble',
  'motion',
  'touchpad',
  'textEntry',
]);

const RESULT_STATUSES = Object.freeze(['paired', 'connected', 'denied', 'failed']);

function requireSafeString(value, field, maxLength) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maxLength ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new TypeError(`${field} must be a bounded, printable string`);
  }
  return value;
}

function optionalSafeString(value, field, maxLength) {
  if (value === undefined || value === null || value === '') return null;
  return requireSafeString(value, field, maxLength);
}

function normalizeBattery(value) {
  if (value === undefined || value === null) return null;
  if (!Number.isFinite(value)) throw new TypeError('battery must be a finite number');
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeCapabilities(capabilities = {}) {
  if (!capabilities || typeof capabilities !== 'object' || Array.isArray(capabilities)) {
    throw new TypeError('capabilities must be an object');
  }
  return Object.freeze(
    Object.fromEntries(CAPABILITY_KEYS.map((key) => [key, capabilities[key] === true])),
  );
}

/** Normalize native discovery output without retaining addresses or platform secrets. */
export function normalizeBluetoothDevice(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Bluetooth device must be an object');
  }
  const id = requireSafeString(input.id, 'id', MAX_ID_LENGTH);
  const transport = input.transport;
  if (!BLUETOOTH_TRANSPORTS.includes(transport))
    throw new TypeError('unsupported Bluetooth transport');
  const kind = BLUETOOTH_DEVICE_KINDS.includes(input.kind) ? input.kind : 'unknown';
  return Object.freeze({
    id,
    name: optionalSafeString(input.name, 'name', MAX_NAME_LENGTH) ?? 'Bluetooth device',
    kind,
    transport,
    paired: input.paired === true,
    connected: input.connected === true,
    battery: normalizeBattery(input.battery),
    capabilities: normalizeCapabilities(input.capabilities),
  });
}

export function normalizeBluetoothSnapshot(devices) {
  if (!Array.isArray(devices)) throw new TypeError('Bluetooth discovery result must be an array');
  if (devices.length > MAX_DEVICES)
    throw new RangeError(`Bluetooth discovery is limited to ${MAX_DEVICES} devices`);
  const normalized = [];
  const seen = new Set();
  for (const device of devices) {
    const value = normalizeBluetoothDevice(device);
    if (!seen.has(value.id)) {
      seen.add(value.id);
      normalized.push(value);
    }
  }
  return Object.freeze(normalized);
}

export function createBluetoothPairingRequest({ deviceId, consent = false } = {}) {
  const id = requireSafeString(deviceId, 'deviceId', MAX_ID_LENGTH);
  if (consent !== true)
    throw new Error('explicit user consent is required before Bluetooth pairing');
  return Object.freeze({ deviceId: id, consent: true });
}

export function normalizeBluetoothPairingResult(result, requestedDeviceId) {
  const id = requireSafeString(requestedDeviceId, 'requestedDeviceId', MAX_ID_LENGTH);
  if (!result || typeof result !== 'object' || !RESULT_STATUSES.includes(result.status)) {
    throw new TypeError('invalid Bluetooth pairing result');
  }
  if (result.deviceId !== undefined && result.deviceId !== id)
    throw new Error('pairing result device mismatch');
  return Object.freeze({ deviceId: id, status: result.status });
}

export function createBluetoothReconnectPlan({ device, permission = false, maxAttempts = 3 } = {}) {
  const normalized = normalizeBluetoothDevice(device);
  if (permission !== true || normalized.paired !== true)
    return Object.freeze({ allowed: false, attempts: 0, deviceId: normalized.id });
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3)
    throw new RangeError('maxAttempts must be an integer from 1 to 3');
  return Object.freeze({ allowed: true, attempts: maxAttempts, deviceId: normalized.id });
}

/**
 * Native adapters implement discovery/pair/connect/forget. This boundary deliberately
 * never downloads drivers or auto-pairs unknown devices; privileged platform code owns that work.
 */
export function createBluetoothManager({ platform, adapter, permission = false } = {}) {
  if (!BLUETOOTH_PLATFORMS.includes(platform))
    throw new Error(`unsupported Bluetooth platform: ${platform}`);
  if (!adapter || typeof adapter !== 'object') throw new TypeError('Bluetooth adapter is required');
  let approved = new Set();
  const requirePermission = () => {
    if (permission !== true) throw new Error('Bluetooth permission has not been granted');
  };
  return Object.freeze({
    async discover() {
      requirePermission();
      if (typeof adapter.discover !== 'function')
        throw new Error('Bluetooth discovery is unavailable');
      return normalizeBluetoothSnapshot(await adapter.discover());
    },
    async pair(deviceId) {
      requirePermission();
      const request = createBluetoothPairingRequest({ deviceId, consent: true });
      if (typeof adapter.pair !== 'function') throw new Error('Bluetooth pairing is unavailable');
      const result = normalizeBluetoothPairingResult(await adapter.pair(request), request.deviceId);
      if (result.status === 'paired' || result.status === 'connected')
        approved = new Set(approved).add(result.deviceId);
      return result;
    },
    async reconnect(device) {
      requirePermission();
      const plan = createBluetoothReconnectPlan({ device, permission, maxAttempts: 3 });
      if (!plan.allowed || !approved.has(plan.deviceId))
        throw new Error('device is not approved for reconnect');
      if (typeof adapter.connect !== 'function')
        throw new Error('Bluetooth reconnect is unavailable');
      return normalizeBluetoothPairingResult(
        await adapter.connect({ deviceId: plan.deviceId }),
        plan.deviceId,
      );
    },
    async forget(deviceId) {
      requirePermission();
      const id = requireSafeString(deviceId, 'deviceId', MAX_ID_LENGTH);
      if (typeof adapter.forget !== 'function') throw new Error('Bluetooth forget is unavailable');
      await adapter.forget({ deviceId: id });
      approved = new Set(approved);
      approved.delete(id);
    },
  });
}
