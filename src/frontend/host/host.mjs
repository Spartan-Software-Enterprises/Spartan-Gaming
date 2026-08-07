const SUPPORTED_TRANSPORTS = Object.freeze(['webrtc', 'webtransport', 'websocket']);
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);
const PAIRING_CODE = /^[A-HJ-NP-Z2-9]{6,12}$/;

function requiredString(value, name) { if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} must be a non-empty string`); return value.trim(); }
function isLocalHost(hostname) { return LOCAL_HOSTNAMES.has(hostname.toLowerCase()) || hostname.endsWith('.local'); }

export function parseHostEndpoint(value, {allowInsecureLocalhost = true} = {}) {
  const raw = requiredString(value, 'endpoint');
  let url;
  try { url = new URL(raw); } catch { throw new TypeError('endpoint must be a valid URL'); }
  if (!['https:', 'wss:', 'http:', 'ws:'].includes(url.protocol)) throw new TypeError('endpoint must use https, wss, http, or ws');
  if (url.username || url.password) throw new TypeError('endpoint must not contain credentials');
  if (url.hash) throw new TypeError('endpoint must not contain a fragment');
  const local = isLocalHost(url.hostname);
  const secure = url.protocol === 'https:' || url.protocol === 'wss:';
  if (!secure && (!local || !allowInsecureLocalhost)) throw new TypeError('remote host endpoints must use TLS');
  return Object.freeze({url: url.toString(), origin: url.origin, hostname: url.hostname, protocol: url.protocol, path: url.pathname, secure, local});
}

export function selectHostTransport({clientTransports = SUPPORTED_TRANSPORTS, hostTransports = SUPPORTED_TRANSPORTS, endpoint} = {}) {
  const parsed = typeof endpoint === 'string' ? parseHostEndpoint(endpoint) : endpoint;
  const available = clientTransports.filter(transport => hostTransports.includes(transport) && SUPPORTED_TRANSPORTS.includes(transport));
  if (!available.length) throw new Error('No compatible host transport');
  const selected = available.find(transport => transport === 'webrtc') || available[0];
  if (parsed && !parsed.secure && !parsed.local && selected !== 'websocket') throw new Error('Insecure remote host transport rejected');
  return selected;
}

export function createPairingRequest({hostId, clientName = 'Spartan Gaming', pairingCode, expiresAt} = {}) {
  requiredString(hostId, 'hostId'); requiredString(clientName, 'clientName');
  const code = requiredString(pairingCode, 'pairingCode').toUpperCase().replace(/[-\s]/g, '');
  if (!PAIRING_CODE.test(code)) throw new TypeError('pairingCode must be 6–12 characters using the safe pairing alphabet');
  const expiry = expiresAt || new Date(Date.now() + 5 * 60 * 1000).toISOString();
  if (Number.isNaN(Date.parse(expiry))) throw new TypeError('expiresAt must be an ISO timestamp');
  return Object.freeze({type: 'host.pair', version: 1, hostId, clientName, pairingCode: code, expiresAt: new Date(expiry).toISOString()});
}

export function createHostConnectionProfile({hostId, endpoint, clientTransports, hostTransports, pairingCode, clientName, expiresAt} = {}) {
  requiredString(hostId, 'hostId'); const parsed = parseHostEndpoint(endpoint); const transport = selectHostTransport({clientTransports, hostTransports, endpoint: parsed});
  return Object.freeze({hostId, endpoint: parsed, transport, pairing: pairingCode ? createPairingRequest({hostId, clientName, pairingCode, expiresAt}) : undefined, credentials: 'session-scoped'});
}
