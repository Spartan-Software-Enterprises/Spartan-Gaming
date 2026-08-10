const ID = /^[A-Za-z0-9._:-]{1,128}$/;
const RUNTIME_KINDS = new Set(['native-adapter', 'native-emulator', 'libretro-core', 'proton']);
const SHA256 = /^[a-f0-9]{64}$/i;

function text(value, name, max = 128) { if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000\r\n]/.test(value)) throw new TypeError(`${name} must be a bounded string`); return value.trim(); }
function file(value, name) { if (!value || typeof value !== 'object') throw new TypeError(`${name} is required`); if (['path', 'source', 'executablePath', 'bytes'].some(key => key in value)) throw new Error(`${name} accepts metadata only`); const result = {name: text(value.name, `${name}.name`, 255), size: Number(value.size)}; if (!Number.isSafeInteger(result.size) || result.size < 0) throw new TypeError(`${name}.size must be a non-negative safe integer`); if (value.sha256 !== undefined) { const digest = text(value.sha256, `${name}.sha256`, 64); if (!SHA256.test(digest)) throw new TypeError(`${name}.sha256 must be a SHA-256 digest`); result.sha256 = digest.toLowerCase(); } return Object.freeze(result); }

/** Validate the metadata-only browser launch descriptor at the native boundary. */
export function normalizeHostLaunchRequest(request) {
  if (!request || request.version !== 1 || request.kind !== 'emulator') throw new TypeError('unsupported host launch request');
  if (request.consent?.approved !== true) throw new Error('native launch consent is missing');
  const runtime = request.runtime; if (!runtime || !RUNTIME_KINDS.has(runtime.kind)) throw new TypeError('host launch runtime kind is unsupported');
  const hostContentId = text(request.hostContentId, 'hostContentId'); if (!ID.test(hostContentId)) throw new TypeError('hostContentId is invalid');
  const content = request.content; if (!content || typeof content !== 'object') throw new TypeError('host launch content is required');
  const firmware = Array.isArray(content.firmware) ? content.firmware.map((entry, index) => file(entry, `content.firmware[${index}]`)) : [];
  return Object.freeze({version: 1, kind: 'emulator', coreId: text(request.coreId, 'coreId'), runtime: Object.freeze({id: text(runtime.id, 'runtime.id'), kind: runtime.kind, version: text(runtime.version, 'runtime.version')}), hostContentId, content: Object.freeze({game: file(content.game, 'content.game'), firmware: Object.freeze(firmware)}), consent: Object.freeze({approved: true, at: text(request.consent.at, 'consent.at', 64)})});
}

export function matchesHostLaunchRequest(request, {runtimeId, hostContentId, gameName} = {}) {
  const normalized = normalizeHostLaunchRequest(request);
  return normalized.runtime.id === text(runtimeId, 'runtimeId') && normalized.hostContentId === text(hostContentId, 'hostContentId') && normalized.content.game.name === text(gameName, 'gameName', 255);
}
