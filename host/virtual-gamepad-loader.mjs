import {describeVirtualGamepadReadiness, normalizeVirtualGamepadConfig} from './virtual-gamepad-config.mjs';
const PLATFORMS = new Set(['win32', 'darwin', 'linux']);

function required(value, name) { if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`); return value.trim(); }

/** Load an operator-installed, platform-specific virtual-gamepad driver adapter. */
export async function loadVirtualGamepadAdapter({platform, packageName, backend = 'Automatic', deviceId, deviceIds, config, loader = name => import(name), runtime, allowUnverified = false, options = {}} = {}) {
  if (!PLATFORMS.has(platform)) throw new TypeError(`unsupported virtual gamepad platform: ${platform}`);
  const normalized = config || normalizeVirtualGamepadConfig({platform, backend, packageName, deviceId, deviceIds});
  if (normalized.backend === 'Disabled' || normalized.backend === 'Browser Gamepad') return Object.freeze({status: 'not-required', platform, packageName: null, reason: null, readiness: describeVirtualGamepadReadiness({config: normalized})});
  const name = normalized.packageName || (runtime ? 'installed virtual-gamepad runtime' : required(normalized.packageName, 'packageName'));
  if (typeof loader !== 'function') throw new TypeError('loader must be a function');
  if (!runtime && !allowUnverified) { const reason = 'a verified installed runtime for virtual-gamepad is required'; return Object.freeze({status: 'unavailable', platform, packageName: name, reason, readiness: describeVirtualGamepadReadiness({config: normalized, adapterStatus: 'unavailable', adapterReason: reason})}); }
  let adapter; let verifiedPackageName = name;
  try {
    if (runtime) {
      if (typeof runtime.load !== 'function') throw new TypeError('verified virtual gamepad runtime must implement load()');
      const loaded = await runtime.load({options: {config: normalized, ...options}}); adapter = loaded?.adapter; verifiedPackageName = loaded?.manifest?.id || name;
    } else {
      const module = await loader(name);
      if (typeof module?.createVirtualGamepad !== 'function') { const reason = 'virtual gamepad package must export createVirtualGamepad'; return Object.freeze({status: 'unavailable', platform, packageName: name, reason, readiness: describeVirtualGamepadReadiness({config: normalized, adapterStatus: 'unavailable', adapterReason: reason})}); }
      adapter = await module.createVirtualGamepad({platform, config: normalized, ...options});
    }
  } catch (error) { const reason = error?.code === 'ERR_MODULE_NOT_FOUND' ? 'virtual gamepad package is not installed' : error?.message || 'virtual gamepad adapter initialization failed'; return Object.freeze({status: 'unavailable', platform, packageName: name, reason, readiness: describeVirtualGamepadReadiness({config: normalized, adapterStatus: 'unavailable', adapterReason: reason})}); }
  if (!adapter || adapter.platform !== platform || typeof adapter.execute !== 'function') { const reason = 'virtual gamepad adapter returned an invalid binding'; return Object.freeze({status: 'unavailable', platform, packageName: name, reason, readiness: describeVirtualGamepadReadiness({config: normalized, adapterStatus: 'unavailable', adapterReason: reason})}); }
  return Object.freeze({status: 'available', platform, packageName: verifiedPackageName, config: normalized, capabilities: Object.freeze({virtualGamepad: true}), readiness: describeVirtualGamepadReadiness({config: normalized, adapterStatus: 'available'}), adapter});
}
