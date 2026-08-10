import {readFileSync} from 'node:fs';
import {normalizeVirtualGamepadConfig} from './virtual-gamepad-config.mjs';

const KEYS = new Set(['platform', 'hostId', 'hostName', 'bind', 'port', 'nativePackage', 'virtualGamepadPackage', 'virtualGamepadBackend', 'virtualGamepadDevice', 'enableInput', 'enableNativeMedia', 'enableNativeAudio', 'audioSource', 'audioBackend', 'tlsKey', 'tlsCert', 'allowedOrigins', 'maxConnections', 'maxMessagesPerSecond']);
const SECRET_KEYS = new Set(['secret', 'adminSecret', 'turnSecret', 'pairingCode', 'signalTicket']);

function text(value, name, maximum = 256) { if (value === undefined || value === null || value === '') return undefined; if (typeof value !== 'string' || !value.trim() || value.length > maximum || /[\u0000\r\n]/.test(value)) throw new TypeError(`${name} must be a bounded single-line string`); return value.trim(); }
function integer(value, name, fallback, minimum, maximum) { if (value === undefined) return fallback; const result = Number(value); if (!Number.isInteger(result) || result < minimum || result > maximum) throw new RangeError(`${name} must be between ${minimum} and ${maximum}`); return result; }
function flag(value, name, fallback = false) { if (value === undefined) return fallback; if (typeof value !== 'boolean') throw new TypeError(`${name} must be boolean`); return value; }

export function normalizeHostConfig(input = {}, {platform = process.platform} = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('host configuration must be an object');
  for (const key of Object.keys(input)) { if (SECRET_KEYS.has(key)) throw new Error(`${key} cannot be stored in host configuration`); if (!KEYS.has(key)) throw new Error(`unknown host configuration key: ${key}`); }
  const selectedPlatform = text(input.platform, 'platform', 16) || platform;
  if (selectedPlatform !== platform) throw new Error(`host configuration platform ${selectedPlatform} does not match runtime platform ${platform}`);
  const allowedOrigins = input.allowedOrigins === undefined ? [] : (Array.isArray(input.allowedOrigins) ? input.allowedOrigins.map((origin, index) => text(origin, `allowedOrigins[${index}]`, 512)) : (() => { throw new TypeError('allowedOrigins must be an array'); })());
  if (allowedOrigins.some(origin => !/^https:\/\//i.test(origin))) throw new TypeError('allowedOrigins must contain HTTPS origins');
  const virtualGamepad = normalizeVirtualGamepadConfig({platform: selectedPlatform, backend: input.virtualGamepadBackend, packageName: input.virtualGamepadPackage, deviceId: input.virtualGamepadDevice});
  return Object.freeze({platform: selectedPlatform, hostId: text(input.hostId, 'hostId', 128), hostName: text(input.hostName, 'hostName', 128), bind: text(input.bind, 'bind', 128), port: integer(input.port, 'port', 8787, 0, 65535), nativePackage: text(input.nativePackage, 'nativePackage', 160), virtualGamepadPackage: virtualGamepad.packageName, virtualGamepadBackend: virtualGamepad.backend, virtualGamepadDevice: virtualGamepad.deviceId, enableInput: flag(input.enableInput, 'enableInput'), enableNativeMedia: flag(input.enableNativeMedia, 'enableNativeMedia'), enableNativeAudio: flag(input.enableNativeAudio, 'enableNativeAudio'), audioSource: text(input.audioSource, 'audioSource', 256), audioBackend: text(input.audioBackend, 'audioBackend', 64), tlsKey: text(input.tlsKey, 'tlsKey', 512), tlsCert: text(input.tlsCert, 'tlsCert', 512), allowedOrigins: Object.freeze([...new Set(allowedOrigins)]), maxConnections: integer(input.maxConnections, 'maxConnections', 8, 1, 256), maxMessagesPerSecond: integer(input.maxMessagesPerSecond, 'maxMessagesPerSecond', 120, 1, 10000), virtualGamepad});
}

export function readHostConfig(path, {platform = process.platform, readFile = readFileSync} = {}) {
  const location = text(path, 'config path', 1024); if (!location) return normalizeHostConfig({}, {platform});
  let parsed; try { parsed = JSON.parse(readFile(location, 'utf8')); } catch { throw new Error('host configuration file is not valid JSON'); }
  return normalizeHostConfig(parsed, {platform});
}
