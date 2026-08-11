const SUPPORTED_TRANSPORTS = Object.freeze(['webrtc', 'webtransport', 'websocket']);
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);
const PAIRING_CODE = /^[A-HJ-NP-Z2-9]{6,12}$/;
export const HOST_PROFILES_KEY = 'spartan-gaming.host-profiles.v1';
export const PENDING_HOST_PAIR_KEY = 'spartan-gaming.pending-host-pair.v1';

function requiredString(value, name) {
  if (typeof value !== 'string' || value.trim() === '')
    throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}
function isLocalHost(hostname) {
  return LOCAL_HOSTNAMES.has(hostname.toLowerCase()) || hostname.endsWith('.local');
}

export function parseHostEndpoint(value, { allowInsecureLocalhost = true } = {}) {
  const raw = requiredString(value, 'endpoint');
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new TypeError('endpoint must be a valid URL');
  }
  if (!['https:', 'wss:', 'http:', 'ws:'].includes(url.protocol))
    throw new TypeError('endpoint must use https, wss, http, or ws');
  if (url.username || url.password) throw new TypeError('endpoint must not contain credentials');
  if (url.hash) throw new TypeError('endpoint must not contain a fragment');
  const local = isLocalHost(url.hostname);
  const secure = url.protocol === 'https:' || url.protocol === 'wss:';
  if (!secure && (!local || !allowInsecureLocalhost))
    throw new TypeError('remote host endpoints must use TLS');
  return Object.freeze({
    url: url.toString(),
    origin: url.origin,
    hostname: url.hostname,
    protocol: url.protocol,
    path: url.pathname,
    secure,
    local,
  });
}

export function selectHostTransport({
  clientTransports = SUPPORTED_TRANSPORTS,
  hostTransports = SUPPORTED_TRANSPORTS,
  endpoint,
} = {}) {
  const parsed = typeof endpoint === 'string' ? parseHostEndpoint(endpoint) : endpoint;
  const available = clientTransports.filter(
    (transport) => hostTransports.includes(transport) && SUPPORTED_TRANSPORTS.includes(transport),
  );
  if (!available.length) throw new Error('No compatible host transport');
  const selected = available.find((transport) => transport === 'webrtc') || available[0];
  if (parsed && !parsed.secure && !parsed.local && selected !== 'websocket')
    throw new Error('Insecure remote host transport rejected');
  return selected;
}

export function createPairingRequest({
  hostId,
  clientName = 'Spartan Gaming',
  pairingCode,
  expiresAt,
} = {}) {
  requiredString(hostId, 'hostId');
  requiredString(clientName, 'clientName');
  const code = requiredString(pairingCode, 'pairingCode').toUpperCase().replace(/[-\s]/g, '');
  if (!PAIRING_CODE.test(code))
    throw new TypeError('pairingCode must be 6–12 characters using the safe pairing alphabet');
  const expiry = expiresAt || new Date(Date.now() + 5 * 60 * 1000).toISOString();
  if (Number.isNaN(Date.parse(expiry))) throw new TypeError('expiresAt must be an ISO timestamp');
  return Object.freeze({
    type: 'host.pair',
    version: 1,
    hostId,
    clientName,
    pairingCode: code,
    expiresAt: new Date(expiry).toISOString(),
  });
}

export function createHostConnectionProfile({
  hostId,
  endpoint,
  clientTransports,
  hostTransports,
  pairingCode,
  clientName,
  expiresAt,
} = {}) {
  requiredString(hostId, 'hostId');
  const parsed = parseHostEndpoint(endpoint);
  const transport = selectHostTransport({ clientTransports, hostTransports, endpoint: parsed });
  return Object.freeze({
    hostId,
    endpoint: parsed,
    transport,
    pairing: pairingCode
      ? createPairingRequest({ hostId, clientName, pairingCode, expiresAt })
      : undefined,
    credentials: 'session-scoped',
  });
}

export function createPendingHostPair({
  hostId,
  name,
  endpoint,
  pairingCode,
  clientName = 'Spartan Gaming',
  expiresAt,
  sessionId,
} = {}) {
  requiredString(hostId, 'hostId');
  requiredString(name, 'name');
  const parsed = parseHostEndpoint(endpoint);
  if (!['ws:', 'wss:'].includes(parsed.protocol))
    throw new TypeError('pending host endpoint must use ws or wss');
  const pairing = createPairingRequest({ hostId, clientName, pairingCode, expiresAt });
  return Object.freeze({
    version: 1,
    endpoint: parsed.url,
    hostId: hostId.trim(),
    name: name.trim(),
    pairingCode: pairing.pairingCode,
    expiresAt: pairing.expiresAt,
    ...(sessionId ? { sessionId: requiredString(sessionId, 'sessionId') } : {}),
  });
}

export function savePendingHostPair(storage = globalThis.sessionStorage, values) {
  if (!storage || typeof storage.setItem !== 'function')
    throw new TypeError('session storage is required');
  const pending = createPendingHostPair(values);
  storage.setItem(PENDING_HOST_PAIR_KEY, JSON.stringify(pending));
  return pending;
}

export function readPendingHostPair(storage = globalThis.sessionStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(PENDING_HOST_PAIR_KEY) || 'null');
    if (!parsed || parsed.version !== 1 || Date.parse(parsed.expiresAt) <= Date.now()) return null;
    return createPendingHostPair(parsed);
  } catch {
    return null;
  }
}

export function clearPendingHostPair(storage = globalThis.sessionStorage) {
  storage?.removeItem?.(PENDING_HOST_PAIR_KEY);
}

export function normalizeHostProfile(profile) {
  requiredString(profile?.hostId, 'profile.hostId');
  requiredString(profile?.name, 'profile.name');
  const endpoint = parseHostEndpoint(profile.endpoint);
  const transports = Array.isArray(profile.hostTransports)
    ? profile.hostTransports.filter((item) => SUPPORTED_TRANSPORTS.includes(item))
    : [...SUPPORTED_TRANSPORTS];
  return Object.freeze({
    hostId: profile.hostId.trim(),
    name: profile.name.trim(),
    endpoint: endpoint.url,
    hostTransports: transports.length ? transports : ['webrtc'],
    clientName: String(profile.clientName || 'Spartan Gaming').trim() || 'Spartan Gaming',
    notes: String(profile.notes || ''),
  });
}

export function createHostProfileStore({
  storage = globalThis.localStorage,
  key = HOST_PROFILES_KEY,
} = {}) {
  const backend = storage;
  const read = () => {
    try {
      const parsed = JSON.parse(backend?.getItem(key) || '[]');
      return Array.isArray(parsed) ? parsed.map(normalizeHostProfile) : [];
    } catch {
      return [];
    }
  };
  const write = (profiles) => backend?.setItem(key, JSON.stringify(profiles));
  return {
    list() {
      return read().map((profile) => ({ ...profile }));
    },
    get(hostId) {
      const profile = read().find((item) => item.hostId === hostId);
      return profile ? { ...profile } : undefined;
    },
    save(profile) {
      const normalized = normalizeHostProfile(profile);
      write([...read().filter((item) => item.hostId !== normalized.hostId), normalized]);
      return { ...normalized };
    },
    remove(hostId) {
      write(read().filter((profile) => profile.hostId !== hostId));
    },
    export() {
      return JSON.stringify({ version: 1, profiles: read() }, null, 2);
    },
    import(serialized) {
      const parsed = typeof serialized === 'string' ? JSON.parse(serialized) : serialized;
      if (!Array.isArray(parsed?.profiles)) throw new TypeError('host profile export is invalid');
      write(parsed.profiles.map(normalizeHostProfile));
      return this.list();
    },
  };
}
