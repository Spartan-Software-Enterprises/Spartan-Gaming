import {readFileSync} from 'node:fs';

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
  const brokerPackage = required(options.brokerPackage, 'production broker package');
  const turnUrls = [...new Set(urls(options.turnUrls))];
  if (!turnUrls.length || turnUrls.some(url => !/^turns?:/i.test(url))) throw new TypeError('production TURN URLs must contain turn: or turns: endpoints');
  return Object.freeze({environment: 'production', tls: Object.freeze({keyPath: tlsKey, certPath: tlsCert}), allowedOrigins: Object.freeze(allowedOrigins), sessionStore, brokerPackage, turnUrls: Object.freeze(turnUrls), secrets: Object.freeze({configured: true, adminConfigured: true})});
}

export function resolveConfiguredSecret({env = process.env, name, readFile = readFileSync} = {}) {
  if (typeof name !== 'string' || !name.trim()) throw new TypeError('secret environment name is required');
  const direct = text(env[name]);
  const filePath = text(env[`${name}_FILE`]);
  if (direct && filePath) throw new TypeError(`${name} and ${name}_FILE cannot both be set`);
  if (!filePath) return direct;
  try { return text(readFile(filePath, 'utf8')); } catch { throw new Error(`${name}_FILE could not be read`); }
}

/** Resolve mounted production secrets without returning their values. */
export function resolveProductionConfig({env = process.env, readFile = readFileSync} = {}) {
  const source = {
    secret: resolveConfiguredSecret({env, name: 'SPARTAN_SIGNALING_SECRET', readFile}),
    adminSecret: resolveConfiguredSecret({env, name: 'SPARTAN_SIGNALING_ADMIN_SECRET', readFile}),
    tlsKey: text(env.SPARTAN_SIGNALING_TLS_KEY),
    tlsCert: text(env.SPARTAN_SIGNALING_TLS_CERT),
    allowedOrigins: env.SPARTAN_SIGNALING_ALLOWED_ORIGINS,
    sessionStore: env.SPARTAN_SIGNALING_SESSION_STORE,
    brokerPackage: env.SPARTAN_SIGNALING_BROKER_PACKAGE,
    turnUrls: env.SPARTAN_SIGNALING_TURN_URLS,
  };
  return normalizeProductionConfig(source);
}
