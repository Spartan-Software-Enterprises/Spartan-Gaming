const URL_SCHEMES = new Set(['stun:', 'stuns:', 'turn:', 'turns:']);
const POLICIES = new Set(['all', 'relay']);
const BUNDLES = new Set(['balanced', 'max-compat', 'max-bundle']);

function required(value, name) { if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`); return value.trim(); }
function list(value) { return Array.isArray(value) ? value : value === undefined ? [] : [value]; }

export function normalizeIceServer(server, {allowInsecureTurn = false} = {}) {
  if (!server || typeof server !== 'object' || Array.isArray(server)) throw new TypeError('ICE server must be an object');
  const urls = list(server.urls).map(url => required(url, 'ICE server URL'));
  if (!urls.length || urls.length > 8) throw new RangeError('ICE server must contain between 1 and 8 URLs');
  for (const value of urls) {
    let parsed;
    try { parsed = new URL(value); } catch { throw new TypeError('ICE server URL is invalid'); }
    if (!URL_SCHEMES.has(parsed.protocol)) throw new TypeError(`unsupported ICE URL scheme: ${parsed.protocol}`);
    if (parsed.username || parsed.password) throw new TypeError('ICE credentials must not be embedded in the URL');
    if ((parsed.protocol === 'turn:' || parsed.protocol === 'stun:') && parsed.hostname !== 'localhost' && !allowInsecureTurn && parsed.protocol === 'turn:') throw new TypeError('remote TURN servers must use turns:');
  }
  const normalized = {urls: Object.freeze([...urls])};
  if (server.username !== undefined) normalized.username = required(server.username, 'ICE username');
  if (server.credential !== undefined) normalized.credential = required(server.credential, 'ICE credential');
  if (server.credentialType !== undefined) { if (!['password', 'oauth'].includes(server.credentialType)) throw new TypeError('unsupported ICE credential type'); normalized.credentialType = server.credentialType; }
  return Object.freeze(normalized);
}

export function createIceConfiguration({servers = [], policy = 'all', bundlePolicy = 'max-bundle', iceCandidatePoolSize = 0, allowInsecureTurn = false} = {}) {
  if (!POLICIES.has(policy)) throw new TypeError('ice policy must be all or relay');
  if (!BUNDLES.has(bundlePolicy)) throw new TypeError('unsupported bundle policy');
  const normalized = list(servers);
  if (normalized.length > 8) throw new RangeError('at most 8 ICE servers are supported');
  const poolSize = Number(iceCandidatePoolSize);
  if (!Number.isInteger(poolSize) || poolSize < 0 || poolSize >  sizeLimit()) throw new RangeError('ice candidate pool size is out of bounds');
  return Object.freeze({iceServers: Object.freeze(normalized.map(server => normalizeIceServer(server, {allowInsecureTurn}))), iceTransportPolicy: policy, bundlePolicy, rtcpMuxPolicy: 'require', iceCandidatePoolSize: poolSize});
}

function sizeLimit() { return 16; }

export function redactIceConfiguration(configuration = {}) {
  const servers = Array.isArray(configuration.iceServers) ? configuration.iceServers : [];
  const urls = servers.flatMap(server => list(server.urls).map(url => {
    try {
      const canonical = url.replace(/^([a-z]+):(?!--\/\/)/i, '$1://');
      const parsed = new URL(canonical); return `${parsed.protocol}//${parsed.host}`;
    } catch { return 'invalid'; }
  }));
  return Object.freeze({serverCount: servers.length, urls: Object.freeze(urls), iceTransportPolicy: POLICIES.has(configuration.iceTransportPolicy) ? configuration.iceTransportPolicy : 'all', bundlePolicy: BUNDLES.has(configuration.bundlePolicy) ? configuration.bundlePolicy : 'max-bundle', hasEphemeralCredentials: servers.some(server => Boolean(server.username || server.credential))});
}
