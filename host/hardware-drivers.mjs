const PLATFORMS = Object.freeze([
  'win32',
  'darwin',
  'linux',
  'android',
  'steamos',
  'chromeos',
  'firetv',
]);
const INSTALL_METHODS = Object.freeze([
  'windows-pnp',
  'macos-driverkit',
  'linux-package',
  'native-user-space',
  'bluetooth-native',
]);
const MAX_HARDWARE_IDS = 64;

function required(value, field, max = 128) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > max ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new TypeError(`${field} must be a bounded printable string`);
  }
  return value.trim();
}

function normalizeUrl(value, approvedHosts) {
  const url = new URL(required(value, 'artifact.url', 2048));
  if (url.protocol !== 'https:') throw new TypeError('artifact.url must use HTTPS');
  if (url.username || url.password)
    throw new TypeError('artifact.url must not contain credentials');
  if (
    !Array.isArray(approvedHosts) ||
    approvedHosts.length === 0 ||
    !approvedHosts.includes(url.hostname)
  )
    throw new TypeError('artifact host is not on the approved driver origin allowlist');
  return url.toString();
}

/** Validate a curated, signed driver descriptor. This is metadata only: installation is delegated to a native adapter. */
export function normalizeDriverDescriptor(descriptor, { approvedHosts = [] } = {}) {
  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor))
    throw new TypeError('driver descriptor must be an object');
  const platform = required(descriptor.platform, 'platform');
  if (!PLATFORMS.includes(platform))
    throw new TypeError(`unsupported driver platform: ${platform}`);
  const method = required(descriptor.installMethod, 'installMethod');
  if (!INSTALL_METHODS.includes(method))
    throw new TypeError(`unsupported driver install method: ${method}`);
  if (
    !Array.isArray(descriptor.hardwareIds) ||
    descriptor.hardwareIds.length < 1 ||
    descriptor.hardwareIds.length > MAX_HARDWARE_IDS
  )
    throw new RangeError('hardwareIds are required and bounded');
  const hardwareIds = Object.freeze([
    ...new Set(
      descriptor.hardwareIds.map((id, index) => required(id, `hardwareIds[${index}]`, 256)),
    ),
  ]);
  if (
    !descriptor.signature?.algorithm ||
    !descriptor.signature?.signer ||
    !descriptor.signature?.value
  )
    throw new TypeError('a signed driver descriptor is required');
  const sizeBytes = descriptor.artifact?.sizeBytes;
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > 5_000_000_000)
    throw new RangeError('artifact size is outside the supported bound');
  const integrity = required(descriptor.artifact?.integrity, 'artifact.integrity', 128);
  if (!/^sha256-[A-Za-z0-9_-]+$/.test(integrity))
    throw new TypeError('artifact.integrity must use sha256 encoding');
  return Object.freeze({
    id: required(descriptor.id, 'id'),
    version: required(descriptor.version, 'version'),
    platform,
    installMethod: method,
    hardwareIds,
    artifact: Object.freeze({
      url: normalizeUrl(descriptor.artifact.url, approvedHosts),
      sizeBytes,
      integrity,
    }),
    signature: Object.freeze({
      algorithm: String(descriptor.signature.algorithm),
      signer: String(descriptor.signature.signer),
      value: String(descriptor.signature.value),
    }),
    rollbackVersion:
      descriptor.rollbackVersion === undefined
        ? null
        : required(descriptor.rollbackVersion, 'rollbackVersion'),
  });
}

export function createDriverInstallPlan({
  descriptor,
  platform,
  hardwareId,
  consent = false,
  adminApproved = false,
  approvedHosts = [],
} = {}) {
  const driver = normalizeDriverDescriptor(descriptor, { approvedHosts });
  if (driver.platform !== platform) throw new Error('driver platform does not match the host');
  const id = required(hardwareId, 'hardwareId', 256);
  if (!driver.hardwareIds.includes(id))
    throw new Error('driver does not match the requested hardware');
  if (consent !== true || adminApproved !== true)
    throw new Error('explicit consent and administrator approval are required');
  return Object.freeze({
    status: 'ready',
    driver,
    hardwareId: id,
    requiresRestart: true,
    rollbackVersion: driver.rollbackVersion,
  });
}

export { INSTALL_METHODS, PLATFORMS };
