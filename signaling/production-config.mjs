const SESSION_STORES = new Set(['redis', 'database', 'external']);

function text(value) { return typeof value === 'string' ? value.trim() : ''; }
function required(value, name) { const result = text(value); if (!result) throw new TypeError(`${name} is required`); return result; }
function secret(value, name) { const result = required(value, name); if (result.length < 32) throw new RangeError(`${name} must contain at least 32 characters`); return result; }
function urls(value) { return (Array.isArray(value) ? value : text(value).split(',')).map(text).filter(Boolean); }

/** Validate operator-owned production signaling prerequisites without storing secrets. */
export function normalizeProductionConfig(options = {}) {
  const secretValue = secret(options.secret, 'signaling secret');
  const adminSecret = secret(options.adminSecret, 'admin secret');
  if (adminSecret === secretValue) throw new Error('admin secret must differ from the signaling secret');
  const tlsKey = required(options.tlsKey, 'TLS key path'); const tlsCert = required(options.tlsCert, 'TLS certificate path');
  const allowedOrigins = [...new Set(urls(options.allowedOrigins))];
  if (!allowedOrigins.length || allowedOrigins.some(origin => !origin.startsWith('https://'))) throw new TypeError('production allowed origins must contain HTTPS origins');
  const sessionStore = text(options.sessionStore).toLowerCase();
  if (!SESSION_STORES.has(sessionStore)) throw new TypeError('production session store must be redis, database, or external');
  const turnUrls = [...new Set(urls(options.turnUrls))];
  if (!turnUrls.length || turnUrls.some(url => !/^turns?:/i.test(url))) throw new TypeError('production TURN URLs must contain turn: or turns: endpoints');
  return Object.freeze({environment: 'production', tls: Object.freeze({keyPath: tlsKey, certPath: tlsCert}), allowedOrigins: Object.freeze(allowedOrigins), sessionStore, turnUrls: Object.freeze(turnUrls), secrets: Object.freeze({configured: true, adminConfigured: true})});
}
