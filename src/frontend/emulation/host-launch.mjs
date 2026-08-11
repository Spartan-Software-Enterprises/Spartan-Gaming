const NATIVE_RUNTIMES = new Set(['native-adapter', 'native-emulator', 'libretro-core']);
const ID = /^[A-Za-z0-9._:-]{1,128}$/;
const SHA256 = /^[a-f0-9]{64}$/i;

function text(value, name, max = 128) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > max ||
    /[\u0000\r\n]/.test(value)
  )
    throw new TypeError(`${name} must be a bounded string`);
  return value.trim();
}
function metadata(file, name) {
  if (!file?.userSelected || !Number.isFinite(Number(file.size)) || Number(file.size) < 0)
    throw new Error(`${name} must be explicitly selected in this browser session`);
  const result = {
    name: text(file.name, `${name}.name`, 255),
    size: Math.floor(Number(file.size)),
  };
  if (file.sha256) {
    const digest = text(file.sha256, `${name}.sha256`, 64);
    if (!SHA256.test(digest)) throw new TypeError(`${name}.sha256 must be a SHA-256 digest`);
    result.sha256 = digest.toLowerCase();
  }
  return Object.freeze(result);
}

/** Create the browser-to-native launch descriptor without exposing file bytes or paths. */
export function createNativeHostLaunchRequest({
  plan,
  runtimeProfile = plan?.integration?.runtimeProfile,
  hostContentId,
  consent = false,
  clock = () => new Date().toISOString(),
} = {}) {
  if (!plan || plan.status !== 'ready' || !NATIVE_RUNTIMES.has(plan.integration?.runtime))
    throw new Error('a ready native emulation plan is required');
  if (!runtimeProfile || runtimeProfile.trust === 'unverified' || runtimeProfile.enabled === false)
    throw new Error('a trusted enabled runtime profile is required');
  if (runtimeProfile.id !== plan.integration.runtimeProfile?.id)
    throw new Error('runtime profile does not match the selected emulation plan');
  if (consent !== true) throw new Error('explicit native launch consent is required');
  const contentId = text(hostContentId, 'hostContentId');
  if (!ID.test(contentId)) throw new TypeError('hostContentId contains unsupported characters');
  const files = plan.files || [];
  const game = metadata(
    files.find((file) => file.kind === 'game'),
    'gameFile',
  );
  const firmware = files
    .filter((file) => file.kind === 'firmware')
    .map((file, index) => metadata(file, `firmwareFiles[${index}]`));
  return Object.freeze({
    version: 1,
    kind: 'emulator',
    coreId: text(plan.coreId, 'coreId'),
    runtime: Object.freeze({
      id: text(runtimeProfile.id, 'runtime.id'),
      kind: text(runtimeProfile.kind, 'runtime.kind'),
      version: text(runtimeProfile.version, 'runtime.version'),
    }),
    hostContentId: contentId,
    content: Object.freeze({ game: Object.freeze(game), firmware: Object.freeze(firmware) }),
    consent: Object.freeze({ approved: true, at: text(clock(), 'consent.at', 64) }),
  });
}
