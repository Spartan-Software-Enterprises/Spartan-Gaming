const PLATFORMS = new Set(['win32', 'darwin', 'linux']);

function required(value, name) { if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`); return value.trim(); }

/** Load an operator-installed, platform-specific virtual-gamepad driver adapter. */
export async function loadVirtualGamepadAdapter({platform, packageName, loader = name => import(name), options = {}} = {}) {
  if (!PLATFORMS.has(platform)) throw new TypeError(`unsupported virtual gamepad platform: ${platform}`);
  const name = required(packageName, 'packageName');
  if (typeof loader !== 'function') throw new TypeError('loader must be a function');
  let module;
  try { module = await loader(name); } catch (error) { return Object.freeze({status: 'unavailable', platform, packageName: name, reason: error?.code === 'ERR_MODULE_NOT_FOUND' ? 'virtual gamepad package is not installed' : 'virtual gamepad package failed to load'}); }
  if (typeof module?.createVirtualGamepad !== 'function') return Object.freeze({status: 'unavailable', platform, packageName: name, reason: 'virtual gamepad package must export createVirtualGamepad'});
  let adapter;
  try { adapter = await module.createVirtualGamepad({platform, ...options}); } catch { return Object.freeze({status: 'unavailable', platform, packageName: name, reason: 'virtual gamepad adapter initialization failed'}); }
  if (!adapter || adapter.platform !== platform || typeof adapter.execute !== 'function') return Object.freeze({status: 'unavailable', platform, packageName: name, reason: 'virtual gamepad adapter returned an invalid binding'});
  return Object.freeze({status: 'available', platform, packageName: name, capabilities: Object.freeze({virtualGamepad: true}), adapter});
}
